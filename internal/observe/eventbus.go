package observe

import (
	"sync"
	"time"
)

type EventType string

const (
	EventGossip        EventType = "gossip"
	EventReplication   EventType = "replication"
	EventKeyOp         EventType = "key_op"
	EventNodeStatus    EventType = "node_status"
	EventClusterHealth EventType = "cluster_health"
)

type Event struct {
	Type      EventType   `json:"type"`
	NodeID    string      `json:"node_id"`
	Timestamp time.Time   `json:"timestamp"`
	Metadata  interface{} `json:"metadata,omitempty"`
}

type EventBus struct {
	mu          sync.RWMutex
	subscribers []chan Event
	history     []Event
	maxHistory  int
}

func NewEventBus(maxHistory int) *EventBus {
	return &EventBus{
		subscribers: make([]chan Event, 0),
		history:     make([]Event, 0),
		maxHistory:  maxHistory,
	}
}

func (eb *EventBus) Subscribe() chan Event {
	eb.mu.Lock()
	defer eb.mu.Unlock()
	ch := make(chan Event, 64)
	eb.subscribers = append(eb.subscribers, ch)
	return ch
}

func (eb *EventBus) Unsubscribe(ch chan Event) {
	eb.mu.Lock()
	defer eb.mu.Unlock()
	for i, sub := range eb.subscribers {
		if sub == ch {
			eb.subscribers = append(eb.subscribers[:i], eb.subscribers[i+1:]...)
			close(ch)
			break
		}
	}
}

func (eb *EventBus) Publish(nodeID string, eventType EventType, metadata interface{}) {
	event := Event{
		Type:      eventType,
		NodeID:    nodeID,
		Timestamp: time.Now(),
		Metadata:  metadata,
	}
	eb.PublishEvent(event)
}

func (eb *EventBus) PublishEvent(event Event) {
	eb.mu.Lock()
	// Add to history
	eb.history = append(eb.history, event)
	if len(eb.history) > eb.maxHistory {
		eb.history = eb.history[1:]
	}

	// Broadcast to subscribers
	for _, ch := range eb.subscribers {
		select {
		case ch <- event:
		default:
			// Buffer full, skip this subscriber for this event
		}
	}
	eb.mu.Unlock()
}

func (eb *EventBus) GetHistory() []Event {
	eb.mu.RLock()
	defer eb.mu.RUnlock()
	history := make([]Event, len(eb.history))
	copy(history, eb.history)
	return history
}
