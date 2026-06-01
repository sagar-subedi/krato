package coordinator

import (
	"context"
	"log/slog"
	"sync"
	"time"

	"github.com/sagarsubedi/krato/internal/ring"
	"github.com/sagarsubedi/krato/internal/rpc"
	"github.com/sagarsubedi/krato/internal/store"
)

// Coordinator handles distributed quorum reads, writes, and deletes across the
// hash ring. It owns the RPC client connections and encapsulates all consensus logic
// separately from HTTP transport concerns.
type Coordinator struct {
	nodeID   string
	engine   *store.Engine
	ring     *ring.HashRing
	mu       sync.RWMutex
	rpcConns map[string]*rpc.Client
}

// NewCoordinator creates a new Coordinator instance.
func NewCoordinator(nodeID string, engine *store.Engine, hashRing *ring.HashRing) *Coordinator {
	return &Coordinator{
		nodeID:   nodeID,
		engine:   engine,
		ring:     hashRing,
		rpcConns: make(map[string]*rpc.Client),
	}
}

// ConnectPeer establishes a gRPC connection to a peer node in the cluster.
func (c *Coordinator) ConnectPeer(node ring.Node) error {
	if node.ID == c.nodeID {
		return nil
	}
	c.mu.Lock()
	defer c.mu.Unlock()

	if _, exists := c.rpcConns[node.ID]; exists {
		return nil
	}
	client, err := rpc.NewClient(node.Address)
	if err != nil {
		return err
	}
	c.rpcConns[node.ID] = client
	return nil
}

func (c *Coordinator) getClient(node ring.Node) (*rpc.Client, bool) {
	c.mu.RLock()
	client, exists := c.rpcConns[node.ID]
	c.mu.RUnlock()
	if exists {
		return client, true
	}
	if err := c.ConnectPeer(node); err != nil {
		return nil, false
	}
	c.mu.RLock()
	client = c.rpcConns[node.ID]
	c.mu.RUnlock()
	return client, client != nil
}

// GetNodes returns the target replica nodes for a given key from the hash ring.
func (c *Coordinator) GetNodes(key string, count int) []ring.Node {
	return c.ring.GetNodes(key, count)
}

// Ring exposes the underlying hash ring for callers that need it (e.g., anti-entropy).
func (c *Coordinator) Ring() *ring.HashRing {
	return c.ring
}

// Engine exposes the underlying storage engine for callers that need it (e.g., anti-entropy).
func (c *Coordinator) Engine() *store.Engine {
	return c.engine
}

// NodeID returns the local node's identifier.
func (c *Coordinator) NodeID() string {
	return c.nodeID
}

func quorumSize(nodes int, consistency string) int {
	if consistency == "async" {
		return 1
	}
	w := nodes/2 + 1
	if w > nodes {
		w = nodes
	}
	return w
}

// readResult holds a single read replica response.
type readResult struct {
	val   []byte
	clock store.VectorClock
}

// Read performs a quorum read across all replica nodes for the given key.
func (c *Coordinator) Read(ctx context.Context, key string, consistency string) ([]byte, error) {
	nodes := c.ring.GetNodes(key, 3)
	if len(nodes) == 0 {
		return nil, ErrNoNodes
	}

	W := quorumSize(len(nodes), consistency)

	ctx, cancel := context.WithTimeout(ctx, 2*time.Second)
	defer cancel()

	var wg sync.WaitGroup
	var mu sync.Mutex
	results := make([]readResult, 0, len(nodes))
	successes := 0

	for _, n := range nodes {
		wg.Add(1)
		go func(node ring.Node) {
			defer wg.Done()
			var val []byte
			var found bool
			var clock map[string]int64

			if node.ID == c.nodeID {
				localVal, err := c.engine.Get([]byte(key))
				if err == nil {
					found = true
					decodedVal, decClock, decErr := store.DecodeVersionedValue(localVal)
					if decErr == nil {
						val = decodedVal
						clock = decClock
					} else {
						val = localVal
						clock = store.NewVectorClock()
					}
				}
			} else {
				client, ok := c.getClient(node)
				if !ok {
					return
				}
				var err error
				val, found, clock, err = client.Get(ctx, key)
				if err != nil {
					return
				}
			}

			mu.Lock()
			defer mu.Unlock()
			if found {
				results = append(results, readResult{val: val, clock: clock})
			}
			successes++
		}(n)
	}

	wg.Wait()

	if successes < W {
		return nil, ErrQuorumFailed
	}

	if len(results) == 0 {
		return nil, ErrNotFound
	}

	// Resolve the best version using vector clocks.
	var best readResult
	var hasBest bool
	bestIndex := -1

	for i, res := range results {
		if !hasBest {
			best = res
			hasBest = true
			bestIndex = i
			continue
		}
		if best.clock.Compare(res.clock) < 0 {
			best = res
			bestIndex = i
		}
	}

	// Read-repair: push the latest version to stale replicas.
	for i, res := range results {
		if i != bestIndex && best.clock.Compare(res.clock) > 0 {
			go func(targetNode ring.Node) {
				if targetNode.ID == c.nodeID {
					c.engine.SetVersioned([]byte(key), best.val, best.clock, 0)
				} else {
					c.mu.RLock()
					client, ok := c.rpcConns[targetNode.ID]
					c.mu.RUnlock()
					if ok {
						client.Set(context.Background(), key, best.val, 0, best.clock)
					}
				}
			}(nodes[i])
		}
	}

	return best.val, nil
}

// Write performs a quorum write across all replica nodes for the given key.
func (c *Coordinator) Write(ctx context.Context, key string, value []byte, consistency string) error {
	nodes := c.ring.GetNodes(key, 3)
	if len(nodes) == 0 {
		return ErrNoNodes
	}

	// Fetch the current vector clock from the first replica for CAS semantics.
	var currentClock store.VectorClock
	if len(nodes) > 0 {
		n := nodes[0]
		if n.ID == c.nodeID {
			localVal, err := c.engine.Get([]byte(key))
			if err == nil {
				_, currentClock, _ = store.DecodeVersionedValue(localVal)
			}
		} else {
			if client, ok := c.getClient(n); ok {
				_, found, clock, err := client.Get(context.Background(), key)
				if err == nil && found {
					currentClock = clock
				}
			}
		}
	}
	if currentClock == nil {
		currentClock = store.NewVectorClock()
	}
	currentClock.Increment(c.nodeID)

	W := quorumSize(len(nodes), consistency)

	ctx, cancel := context.WithTimeout(ctx, 2*time.Second)
	defer cancel()

	var wg sync.WaitGroup
	var mu sync.Mutex
	successes := 0

	for _, n := range nodes {
		wg.Add(1)
		go func(node ring.Node) {
			defer wg.Done()
			var err error
			if node.ID == c.nodeID {
				err = c.engine.SetVersioned([]byte(key), value, currentClock, 0)
			} else {
				client, ok := c.getClient(node)
				if !ok {
					return
				}
				err = client.Set(ctx, key, value, 0, currentClock)
			}

			if err == nil {
				mu.Lock()
				successes++
				mu.Unlock()
			}
		}(n)
	}

	if consistency != "async" {
		wg.Wait()
	} else {
		time.Sleep(10 * time.Millisecond)
	}

	if successes < W && consistency != "async" {
		return ErrQuorumFailed
	}

	return nil
}

// Delete performs a quorum delete across all replica nodes for the given key.
func (c *Coordinator) Delete(ctx context.Context, key string, consistency string) error {
	nodes := c.ring.GetNodes(key, 3)
	if len(nodes) == 0 {
		return ErrNoNodes
	}

	W := quorumSize(len(nodes), consistency)

	ctx, cancel := context.WithTimeout(ctx, 2*time.Second)
	defer cancel()

	var wg sync.WaitGroup
	var mu sync.Mutex
	successes := 0

	for _, n := range nodes {
		wg.Add(1)
		go func(node ring.Node) {
			defer wg.Done()
			var err error
			if node.ID == c.nodeID {
				err = c.engine.Delete([]byte(key))
			} else {
				client, ok := c.getClient(node)
				if !ok {
					return
				}
				err = client.Delete(ctx, key)
			}
			if err == nil {
				mu.Lock()
				successes++
				mu.Unlock()
			}
		}(n)
	}

	if consistency != "async" {
		wg.Wait()
	}

	if successes < W && consistency != "async" {
		return ErrQuorumFailed
	}

	return nil
}

// RepairKey pushes a key's value and clock to a specific peer via gRPC.
// Used by the anti-entropy background process.
func (c *Coordinator) RepairKey(ctx context.Context, nodeID, key string, value []byte, clock store.VectorClock) {
	c.mu.RLock()
	client, ok := c.rpcConns[nodeID]
	c.mu.RUnlock()
	if !ok {
		return
	}
	if err := client.Set(ctx, key, value, 0, clock); err != nil {
		slog.Debug("Anti-entropy repair failed", "node", nodeID, "key", key, "error", err)
	}
}
