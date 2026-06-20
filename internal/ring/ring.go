package ring

import (
	"fmt"
	"sort"
	"sync"

	"github.com/cespare/xxhash/v2"
)

type Node struct {
	ID      string
	Address string
}

type HashRing struct {
	mu     sync.RWMutex
	vNodes int
	ring   []uint64
	keys   map[uint64]string
	nodes  map[string]Node
}

func NewHashRing(vNodes int) *HashRing {
	return &HashRing{
		vNodes: vNodes,
		keys:   make(map[uint64]string),
		nodes:  make(map[string]Node),
	}
}

func hashKey(key string) uint64 {
	return xxhash.Sum64String(key)
}

func (hr *HashRing) AddNode(node Node) {
	hr.mu.Lock()
	defer hr.mu.Unlock()

	hr.nodes[node.ID] = node

	for i := 0; i < hr.vNodes; i++ {
		vNodeID := fmt.Sprintf("%s#%d", node.ID, i)
		h := hashKey(vNodeID)
		hr.ring = append(hr.ring, h)
		hr.keys[h] = node.ID
	}

	sort.Slice(hr.ring, func(i, j int) bool {
		return hr.ring[i] < hr.ring[j]
	})
}

func (hr *HashRing) RemoveNode(nodeID string) {
	hr.mu.Lock()
	defer hr.mu.Unlock()

	delete(hr.nodes, nodeID)

	var newRing []uint64
	for _, h := range hr.ring {
		if hr.keys[h] == nodeID {
			delete(hr.keys, h)
		} else {
			newRing = append(newRing, h)
		}
	}
	hr.ring = newRing
}

func (hr *HashRing) GetNode(key string) (Node, bool) {
	hr.mu.RLock()
	defer hr.mu.RUnlock()

	if len(hr.ring) == 0 {
		return Node{}, false
	}

	h := hashKey(key)

	idx := sort.Search(len(hr.ring), func(i int) bool {
		return hr.ring[i] >= h
	})

	if idx == len(hr.ring) {
		idx = 0
	}

	nodeID := hr.keys[hr.ring[idx]]
	return hr.nodes[nodeID], true
}

func (hr *HashRing) GetNodes(key string, count int) []Node {
	hr.mu.RLock()
	defer hr.mu.RUnlock()

	if len(hr.ring) == 0 {
		return nil
	}

	h := hashKey(key)

	// Find the primary node via the vnode ring
	idx := sort.Search(len(hr.ring), func(i int) bool {
		return hr.ring[i] >= h
	})
	if idx == len(hr.ring) {
		idx = 0
	}
	primaryID := hr.keys[hr.ring[idx]]

	// Build physical ring ordered by minimum token per node
	physicalOrder := hr.physicalRingOrder()

	// Find primary's position in the physical ring and walk clockwise
	var results []Node
	startIdx := 0
	for i, id := range physicalOrder {
		if id == primaryID {
			startIdx = i
			break
		}
	}
	for i := 0; i < len(physicalOrder) && len(results) < count; i++ {
		nid := physicalOrder[(startIdx+i)%len(physicalOrder)]
		results = append(results, hr.nodes[nid])
	}
	return results
}

// physicalRingOrder returns physical node IDs sorted by their minimum vnode hash.
// This gives a stable clockwise ordering that matches the UI visualization.
// MUST be called with hr.mu held.
func (hr *HashRing) physicalRingOrder() []string {
	minHash := make(map[string]uint64)
	for _, nodeID := range hr.nodes {
		minHash[nodeID.ID] = ^uint64(0)
	}
	for h, nodeID := range hr.keys {
		if h < minHash[nodeID] {
			minHash[nodeID] = h
		}
	}
	type entry struct {
		id   string
		hash uint64
	}
	entries := make([]entry, 0, len(minHash))
	for id, h := range minHash {
		entries = append(entries, entry{id, h})
	}
	sort.Slice(entries, func(i, j int) bool {
		return entries[i].hash < entries[j].hash
	})
	ids := make([]string, len(entries))
	for i, e := range entries {
		ids[i] = e.id
	}
	return ids
}

// GetSnapshot returns a clone of the ring state for visualization.
func (hr *HashRing) GetSnapshot() map[uint64]string {
	hr.mu.RLock()
	defer hr.mu.RUnlock()

	snapshot := make(map[uint64]string, len(hr.keys))
	for k, v := range hr.keys {
		snapshot[k] = v
	}
	return snapshot
}

// GetAllNodes returns all physical nodes currently in the ring.
func (hr *HashRing) GetAllNodes() []Node {
	hr.mu.RLock()
	defer hr.mu.RUnlock()

	nodes := make([]Node, 0, len(hr.nodes))
	for _, n := range hr.nodes {
		nodes = append(nodes, n)
	}
	return nodes
}

// GetKeyInfo returns the xxhash of the given key and the IDs of its N replica
// nodes as they appear in ring order. Used to enrich observability events so
// the frontend can visualise key placement and replica highlighting.
func (hr *HashRing) GetKeyInfo(key string, replicas int) (uint64, []string) {
	hr.mu.RLock()
	defer hr.mu.RUnlock()

	if len(hr.ring) == 0 {
		return 0, nil
	}

	h := hashKey(key)

	idx := sort.Search(len(hr.ring), func(i int) bool {
		return hr.ring[i] >= h
	})
	if idx == len(hr.ring) {
		idx = 0
	}
	primaryID := hr.keys[hr.ring[idx]]

	// Use physical ring succession for consistent, adjacent replica assignment
	physicalOrder := hr.physicalRingOrder()
	startIdx := 0
	for i, id := range physicalOrder {
		if id == primaryID {
			startIdx = i
			break
		}
	}

	var nodeIDs []string
	for i := 0; i < len(physicalOrder) && len(nodeIDs) < replicas; i++ {
		nodeIDs = append(nodeIDs, physicalOrder[(startIdx+i)%len(physicalOrder)])
	}

	return h, nodeIDs
}
