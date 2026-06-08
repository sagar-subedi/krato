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

	if _, exists := hr.nodes[node.ID]; exists {
		return
	}

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

	if _, exists := hr.nodes[nodeID]; !exists {
		return
	}

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

	idx := sort.Search(len(hr.ring), func(i int) bool {
		return hr.ring[i] >= h
	})

	if idx == len(hr.ring) {
		idx = 0
	}

	var results []Node
	seen := make(map[string]bool)

	for i := 0; i < len(hr.ring); i++ {
		nodeID := hr.keys[hr.ring[(idx+i)%len(hr.ring)]]
		if !seen[nodeID] {
			seen[nodeID] = true
			results = append(results, hr.nodes[nodeID])
			if len(results) == count {
				break
			}
		}
	}

	return results
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
