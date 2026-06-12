package gossip

import (
	"bytes"
	"encoding/json"
	"log/slog"
	"math/rand"
	"net"
	"sync"
	"time"
)

type NodeState string

const (
	StateAlive   NodeState = "ALIVE"
	StateSuspect NodeState = "SUSPECT"
	StateDead    NodeState = "DEAD"
	StateLeft    NodeState = "LEFT"
)

type Member struct {
	ID          string    `json:"id"`
	GossipAddr  string    `json:"gossip_addr"`
	GrpcAddress string    `json:"grpc_address"`
	State       NodeState `json:"state"`
	Generation  int64     `json:"generation"` // dictates priority of updates
	LastSeen    time.Time `json:"-"`
}

type Message struct {
	Type     string            `json:"type"` // HELLO, SYNC
	SenderID string            `json:"sender_id"`
	Members  map[string]Member `json:"members"`
}

type MemberEvent struct {
	Member Member
	IsJoin bool
	IsDead bool
}

type Gossiper struct {
	nodeID  string
	address string
	mu      sync.RWMutex
	members map[string]*Member
	conn    *net.UDPConn
	quit    chan struct{}
	ringCh  chan MemberEvent
	enabled bool
	seeds   []string
}

func NewGossiper(nodeID, bindAddr, advAddr, grpcAddr string, ringCh chan MemberEvent) (*Gossiper, error) {
	addr, err := net.ResolveUDPAddr("udp", bindAddr)
	if err != nil {
		return nil, err
	}

	conn, err := net.ListenUDP("udp", addr)
	if err != nil {
		return nil, err
	}

	g := &Gossiper{
		nodeID:  nodeID,
		address: advAddr,
		members: make(map[string]*Member),
		conn:    conn,
		quit:    make(chan struct{}),
		ringCh:  ringCh,
		enabled: true,
	}

	// Register self
	g.members[nodeID] = &Member{
		ID:          nodeID,
		GossipAddr:  advAddr,
		GrpcAddress: grpcAddr,
		State:       StateAlive,
		Generation:  time.Now().UnixNano(),
		LastSeen:    time.Now(),
	}

	return g, nil
}

func (g *Gossiper) Start(seedNodes []string) {
	g.mu.Lock()
	g.seeds = seedNodes
	g.mu.Unlock()

	go g.listen()
	go g.gossipLoop()
	go g.failureDetectionLoop()

	if len(seedNodes) > 0 {
		g.join(seedNodes)
		// Re-join after short delays to handle startup race conditions.
		// All nodes start simultaneously; seeds may not all be ready to receive.
		go func() {
			for _, delay := range []time.Duration{2 * time.Second, 5 * time.Second, 10 * time.Second} {
				time.Sleep(delay)
				g.join(seedNodes)
			}
		}()
	}
}

func (g *Gossiper) SetEnabled(enabled bool) {
	g.mu.Lock()
	defer g.mu.Unlock()
	
	if !g.enabled && enabled {
		// Bumping generation on restoration ensures our "ALIVE" state 
		// overrides any "DEAD" markers peers might have gossiped.
		g.members[g.nodeID].Generation = time.Now().UnixNano()
		slog.Info("Gossiper RESTORED, bumping generation", "id", g.nodeID, "new_gen", g.members[g.nodeID].Generation)
		go g.join(g.seeds)
	}
	g.enabled = enabled
}

func (g *Gossiper) Stop() {
	g.mu.Lock()
	mem := g.members[g.nodeID]
	mem.State = StateLeft
	mem.Generation = time.Now().UnixNano()
	g.mu.Unlock()

	g.gossip() // Output final state
	close(g.quit)
	g.conn.Close()
}

func (g *Gossiper) join(seeds []string) {
	g.mu.RLock()
	msg := Message{
		Type:     "HELLO",
		SenderID: g.nodeID,
		Members: map[string]Member{
			g.nodeID: *g.members[g.nodeID],
		},
	}
	g.mu.RUnlock()
	data, _ := json.Marshal(msg)

	for _, seed := range seeds {
		addr, _ := net.ResolveUDPAddr("udp", seed)
		if addr != nil {
			g.conn.WriteToUDP(data, addr)
		}
	}
}

func (g *Gossiper) listen() {
	buf := make([]byte, 65536)
	for {
		n, _, err := g.conn.ReadFromUDP(buf)
		if err != nil {
			select {
			case <-g.quit:
				return
			default:
				continue
			}
		}

		g.mu.RLock()
		enabled := g.enabled
		g.mu.RUnlock()
		if !enabled {
			continue
		}

		slog.Debug("Gossip packet received", "bytes", n)

		var msg Message
		if err := json.NewDecoder(bytes.NewReader(buf[:n])).Decode(&msg); err != nil {
			slog.Error("Gossip decode failed", "error", err)
			continue
		}
		g.merge(msg.SenderID, msg.Members)
	}
}

func (g *Gossiper) merge(senderID string, remote map[string]Member) {
	slog.Debug("Gossip merge started", "nodes_in_packet", len(remote))
	g.mu.Lock()
	defer g.mu.Unlock()

	for id, rMem := range remote {
		if id == g.nodeID {
			continue // Maintain absolute authority over self states
		}

		lMem, exists := g.members[id]
		if !exists {
			g.members[id] = &Member{
				ID:          rMem.ID,
				GossipAddr:  rMem.GossipAddr,
				GrpcAddress: rMem.GrpcAddress,
				State:       rMem.State,
				Generation:  rMem.Generation,
				LastSeen:    time.Now(),
			}
			if rMem.State == StateAlive {
				g.notifyRing(*g.members[id], true, false)
			}
			continue
		}

		if rMem.Generation > lMem.Generation {
			prevState := lMem.State
			lMem.State = rMem.State
			lMem.Generation = rMem.Generation
			lMem.LastSeen = time.Now()

			slog.Info("Gossip update merged", "id", id, "from_state", prevState, "to_state", rMem.State, "gen", rMem.Generation)

			if prevState != StateAlive && rMem.State == StateAlive {
				g.notifyRing(*lMem, true, false)
			} else if prevState != StateDead && rMem.State == StateDead {
				g.notifyRing(*lMem, false, true)
			}
		} else if rMem.Generation == lMem.Generation {
			// AUTHORITATIVE RESET: If this message came DIRECTLY from the node itself 
			// and it's claiming to be ALIVE, we trust it and reset its state/timers.
			// This allows a restored node to re-join peers who may have marked it as DEAD
			// during its isolation, without needing a secondary generation bump.
			if id == senderID && rMem.State == StateAlive {
				lMem.LastSeen = time.Now()
				if lMem.State != StateAlive {
					slog.Info("Gossip state healed by direct heartbeat", "id", id, "new_state", StateAlive)
					lMem.State = StateAlive
					g.notifyRing(*lMem, true, false)
				}
			}
		}
	}
}

func (g *Gossiper) notifyRing(m Member, isJoin, isDead bool) {
	if g.ringCh != nil {
		select {
		case g.ringCh <- MemberEvent{Member: m, IsJoin: isJoin, IsDead: isDead}:
		default:
			// Non blocking drop to prevent deadlocks bridging loops
		}
	}
}

func (g *Gossiper) gossipLoop() {
	ticker := time.NewTicker(500 * time.Millisecond)
	defer ticker.Stop()

	for {
		select {
		case <-ticker.C:
			g.mu.RLock()
			enabled := g.enabled
			g.mu.RUnlock()
			if enabled {
				g.gossip()
			}
		case <-g.quit:
			return
		}
	}
}

func (g *Gossiper) gossip() {
	g.mu.RLock()
	peers := make([]*Member, 0)
	msg := Message{
		Type:     "SYNC",
		SenderID: g.nodeID,
		Members:  make(map[string]Member),
	}
	for id, m := range g.members {
		msg.Members[id] = *m
		if id != g.nodeID && m.State == StateAlive {
			peers = append(peers, m)
		}
	}
	data, _ := json.Marshal(msg)
	g.mu.RUnlock()

	if len(peers) == 0 {
		return
	}

	rand.Shuffle(len(peers), func(i, j int) { peers[i], peers[j] = peers[j], peers[i] })
	targetCount := 3
	if len(peers) < 3 {
		targetCount = len(peers)
	}

	for i := 0; i < targetCount; i++ {
		addr, _ := net.ResolveUDPAddr("udp", peers[i].GossipAddr)
		if addr != nil {
			g.conn.WriteToUDP(data, addr)
		}
	}
}

func (g *Gossiper) failureDetectionLoop() {
	ticker := time.NewTicker(1 * time.Second)
	defer ticker.Stop()

	for {
		select {
		case <-ticker.C:
			g.detectFailures()
		case <-g.quit:
			return
		}
	}
}

func (g *Gossiper) detectFailures() {
	g.mu.Lock()
	defer g.mu.Unlock()

	now := time.Now()
	for id, m := range g.members {
		if id == g.nodeID {
			continue
		}

		if m.State == StateAlive {
			if now.Sub(m.LastSeen) > 3*time.Second {
				m.State = StateSuspect
				slog.Warn("Node suspect", "id", id)
			}
		} else if m.State == StateSuspect {
			if now.Sub(m.LastSeen) > 8*time.Second {
				m.State = StateDead
				// REMOVED: m.Generation = now.UnixNano() 
				// Only the node itself should update its authoritative Generation for state changes.
				// By not bumping generation here, we allow the node to override this "Dead" 
				// state with its own slightly newer "Alive" generation when it comes back.
				slog.Error("Node dead", "id", id)
				g.notifyRing(*m, false, true)
			}
		}
	}
}

func (g *Gossiper) GetMembers() []Member {
	g.mu.RLock()
	defer g.mu.RUnlock()
	res := make([]Member, 0, len(g.members))
	for _, m := range g.members {
		if m.State == StateAlive {
			res = append(res, *m)
		}
	}
	return res
}

func (g *Gossiper) GetFullState() map[string]Member {
	g.mu.RLock()
	defer g.mu.RUnlock()
	res := make(map[string]Member)
	for id, m := range g.members {
		res[id] = *m
	}
	return res
}
