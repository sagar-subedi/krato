package ring

import (
	"fmt"
	"testing"
)

func TestHashRing_AddRemove(t *testing.T) {
	hr := NewHashRing(150)

	nodeA := Node{ID: "nodeA", Address: "10.0.0.1:8080"}
	nodeB := Node{ID: "nodeB", Address: "10.0.0.2:8080"}

	hr.AddNode(nodeA)
	hr.AddNode(nodeB)

	if len(hr.nodes) != 2 {
		t.Fatalf("expected 2 nodes, got %d", len(hr.nodes))
	}
	if len(hr.ring) != 300 {
		t.Fatalf("expected 300 virtual nodes, got %d", len(hr.ring))
	}

	// Remove node A
	hr.RemoveNode(nodeA.ID)
	if len(hr.nodes) != 1 {
		t.Fatalf("expected 1 node, got %d", len(hr.nodes))
	}
	if len(hr.ring) != 150 {
		t.Fatalf("expected 150 virtual nodes, got %d", len(hr.ring))
	}
}

func TestHashRing_Distribution(t *testing.T) {
	hr := NewHashRing(150)

	hr.AddNode(Node{ID: "nodeA", Address: "10.0.0.1:8080"})
	hr.AddNode(Node{ID: "nodeB", Address: "10.0.0.2:8080"})
	hr.AddNode(Node{ID: "nodeC", Address: "10.0.0.3:8080"})

	distribution := make(map[string]int)

	// Test 10,000 keys distribution
	for i := 0; i < 10000; i++ {
		key := fmt.Sprintf("key-%d", i)
		n, ok := hr.GetNode(key)
		if !ok {
			t.Fatalf("expected node to be found")
		}
		distribution[n.ID]++
	}

	for id, count := range distribution {
		// Expect around 3333 keys each, +/- 10% tolerance (usually virt node hashing causes some minor deviation)
		if count < 2500 || count > 4500 {
			t.Errorf("distribution for node %s is skewed: %d keys", id, count)
		}
	}
}

func TestHashRing_GetNode(t *testing.T) {
	hr := NewHashRing(150)

	_, ok := hr.GetNode("missing")
	if ok {
		t.Fatalf("should not get node on empty ring")
	}

	hr.AddNode(Node{ID: "A"})

	n, ok := hr.GetNode("someKey")
	if !ok || n.ID != "A" {
		t.Fatalf("should route to A")
	}
}
