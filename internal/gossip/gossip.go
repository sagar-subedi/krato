package gossip

import (
	"bytes"
	"encoding/json"
	"fmt"
	"log/slog"
	"math/rand"
	"net"
	"sync"
	"time"
	"github.com/sagarsubedi/krato/internal/observe"
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
	Events   []observe.Event   `json:"events,omitempty"`
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
	eventBus *observe.EventBus
	enabled bool
	seeds   []string

	// Event relay state
	pendingEvents []observe.Event
	seenEvents    map[string]time.Time // key = nodeID + timestamp
}

func NewGossiper(nodeID, bindAddr, advAddr, grpcAddr string, ringCh chan MemberEvent, eb *observe.EventBus) (*Gossiper, error) {
	addr, err := net.ResolveUDPAddr("udp", bindAddr)
	if err != nil {
		return nil, err
	}

	conn, err := net.ListenUDP("udp", addr)
	if err != nil {
		return nil, err
	}

	g := &Gossiper{
		nodeID:        nodeID,
		address:       advAddr,
		members:       make(map[string]*Member),
		conn:          conn,
		quit:          make(chan struct{}),
		ringCh:        ringCh,
		eventBus:      eb,
		enabled:       true,
		pendingEvents: make([]observe.Event, 0),
		seenEvents:    make(map[string]time.Time),
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
	go g.eventMaintenanceLoop()

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
		g.merge(msg.SenderID, msg.Members, msg.Events)
	}
}

func (g *Gossiper) merge(senderID string, remote map[string]Member, events []observe.Event) {
	slog.Debug("Gossip merge started", "nodes_in_packet", len(remote), "events_in_packet", len(events))
	g.mu.Lock()
	defer g.mu.Unlock()

	// Handle relay events
	for _, e := range events {
		eventKey := fmt.Sprintf("%s-%d", e.NodeID, e.Timestamp.UnixNano())
		if _, seen := g.seenEvents[eventKey]; seen {
			continue
		}

		g.seenEvents[eventKey] = time.Now()
		// Relay further
		g.pendingEvents = append(g.pendingEvents, e)
		if len(g.pendingEvents) > 50 {
			g.pendingEvents = g.pendingEvents[1:]
		}

		// Publish locally if it's not a local gossip event (already handled by membership)
		if g.eventBus != nil {
			g.eventBus.Publish(e.NodeID, e.Type, e.Metadata)
		}
	}

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

	// Attach pending events to the gossip packet
	msg.Events = g.pendingEvents
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
			if now.Sub(m.LastSeen) > 10*time.Second {
				m.State = StateSuspect
				slog.Warn("Node suspect", "id", id, "last_seen_sec", now.Sub(m.LastSeen).Seconds())
			}
		} else if m.State == StateSuspect {
			if now.Sub(m.LastSeen) > 30*time.Second {
				m.State = StateDead
				slog.Error("Node dead", "id", id, "last_seen_sec", now.Sub(m.LastSeen).Seconds())
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

func (g *Gossiper) BroadcastEvent(event observe.Event) {
	g.mu.Lock()
	defer g.mu.Unlock()

	eventKey := fmt.Sprintf("%s-%d", event.NodeID, event.Timestamp.UnixNano())
	g.seenEvents[eventKey] = time.Now()
	g.pendingEvents = append(g.pendingEvents, event)

	// Cap buffer
	if len(g.pendingEvents) > 50 {
		g.pendingEvents = g.pendingEvents[1:]
	}
}

func (g *Gossiper) eventMaintenanceLoop() {
	ticker := time.NewTicker(5 * time.Minute)
	defer ticker.Stop()

	for {
		select {
		case <-ticker.C:
			g.mu.Lock()
			now := time.Now()
			for k, seenAt := range g.seenEvents {
				if now.Sub(seenAt) > 30*time.Minute {
					delete(g.seenEvents, k)
				}
			}
			g.mu.Unlock()
		case <-g.quit:
			return
		}
	}
}
