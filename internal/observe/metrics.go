package observe

import (
	"sort"
	"sync"
	"time"
)

type Metrics struct {
	mu           sync.RWMutex
	RequestCount uint64
	Latencies    []time.Duration
	P50          time.Duration
	P99          time.Duration
	KeyCount     int
	StartTime    time.Time
}

type MetricsSnapshot struct {
	RequestCount uint64        `json:"request_count"`
	P50          time.Duration `json:"p50"`
	P99          time.Duration `json:"p99"`
	KeyCount     int           `json:"key_count"`
	StartTime    time.Time     `json:"start_time"`
	Uptime       string        `json:"uptime"`
}

func NewMetrics() *Metrics {
	return &Metrics{
		Latencies: make([]time.Duration, 0),
		StartTime: time.Now(),
	}
}

func (m *Metrics) RecordRequest(latency time.Duration) {
	m.mu.Lock()
	defer m.mu.Unlock()

	m.RequestCount++
	m.Latencies = append(m.Latencies, latency)

	// Keep last 1000 latencies for sliding window percentile
	if len(m.Latencies) > 1000 {
		m.Latencies = m.Latencies[1:]
	}

	// Simple periodic update of percentiles (could be optimized)
	if m.RequestCount%10 == 0 {
		m.calculatePercentiles()
	}
}

func (m *Metrics) UpdateKeyCount(count int) {
	m.mu.Lock()
	defer m.mu.Unlock()
	m.KeyCount = count
}

func (m *Metrics) calculatePercentiles() {
	if len(m.Latencies) == 0 {
		return
	}
	// Note: For a real production app, use a more efficient percentile algo like T-Digest
	// but for this project, a simple sort on a small window is fine.
	sorted := make([]time.Duration, len(m.Latencies))
	copy(sorted, m.Latencies)

	// Sort logic simplified here for brevity
	sort.Slice(sorted, func(i, j int) bool { return sorted[i] < sorted[j] })

	m.P50 = sorted[len(sorted)*50/100]
	m.P99 = sorted[len(sorted)*99/100]
}

func (m *Metrics) GetSnapshot() MetricsSnapshot {
	m.mu.RLock()
	defer m.mu.RUnlock()
	return MetricsSnapshot{
		RequestCount: m.RequestCount,
		P50:          m.P50,
		P99:          m.P99,
		KeyCount:     m.KeyCount,
		StartTime:    m.StartTime,
		Uptime:       time.Since(m.StartTime).Truncate(time.Second).String(),
	}
}
