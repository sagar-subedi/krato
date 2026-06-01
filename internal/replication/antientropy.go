package replication

import (
	"context"
	"log/slog"
	"time"

	"github.com/sagarsubedi/krato/internal/coordinator"
	"github.com/sagarsubedi/krato/internal/store"
)

// AntiEntropy is a background service that periodically scans the local store
// and pushes missing or stale data to peer replicas using vector clock comparison.
type AntiEntropy struct {
	coordinator *coordinator.Coordinator
	interval    time.Duration
	quit        chan struct{}
}

// NewAntiEntropy creates a new anti-entropy background repair service.
func NewAntiEntropy(coord *coordinator.Coordinator, interval time.Duration) *AntiEntropy {
	return &AntiEntropy{
		coordinator: coord,
		interval:    interval,
		quit:        make(chan struct{}),
	}
}

// Start begins the anti-entropy loop in a background goroutine.
func (ae *AntiEntropy) Start() {
	go ae.loop()
}

// Stop signals the anti-entropy loop to shut down.
func (ae *AntiEntropy) Stop() {
	close(ae.quit)
}

func (ae *AntiEntropy) loop() {
	ticker := time.NewTicker(ae.interval)
	defer ticker.Stop()

	for {
		select {
		case <-ticker.C:
			ae.run()
		case <-ae.quit:
			return
		}
	}
}

func (ae *AntiEntropy) run() {
	results, err := ae.coordinator.Engine().Scan([]byte{})
	if err != nil {
		slog.Debug("Anti-entropy scan failed", "error", err)
		return
	}

	nodeID := ae.coordinator.NodeID()

	for keyBytes, val := range results {
		decodedVal, clock, err := store.DecodeVersionedValue(val)
		if err != nil {
			continue
		}
		nodes := ae.coordinator.GetNodes(keyBytes, 3)
		for _, n := range nodes {
			if n.ID != nodeID {
				ae.coordinator.RepairKey(context.Background(), n.ID, keyBytes, decodedVal, clock)
			}
		}
	}
}
