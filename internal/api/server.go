package api

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"log/slog"
	"net/http"
	"sync"
	"time"

	"github.com/gorilla/websocket"
	"github.com/prometheus/client_golang/prometheus"
	"github.com/prometheus/client_golang/prometheus/promhttp"
	"github.com/sagarsubedi/krato/internal/coordinator"
	"github.com/sagarsubedi/krato/internal/genai"
	"github.com/sagarsubedi/krato/internal/observe"
)

var (
	opsTotal = prometheus.NewCounterVec(
		prometheus.CounterOpts{
			Name: "krato_ops_total",
			Help: "Total distributed operations processed by type.",
		},
		[]string{"op"},
	)

	upgrader = websocket.Upgrader{
		CheckOrigin: func(r *http.Request) bool { return true },
	}
)

func init() {
	prometheus.MustRegister(opsTotal)
}

type Server struct {
	coord   *coordinator.Coordinator
	events  *observe.EventBus
	metrics *observe.Metrics
	ai      *genai.Engine
	mux     *http.ServeMux
}

func NewServer(coord *coordinator.Coordinator, events *observe.EventBus, metrics *observe.Metrics, ai *genai.Engine) *Server {
	s := &Server{
		coord:   coord,
		events:  events,
		metrics: metrics,
		ai:      ai,
		mux:     http.NewServeMux(),
	}
	s.routes()
	return s
}

func (s *Server) routes() {
	// Traditional KV API
	s.mux.HandleFunc("/keys/", s.handleKeys)
	s.mux.Handle("/metrics", promhttp.Handler())

	// New Observability & UI API
	s.mux.HandleFunc("/ws", s.handleWS)
	s.mux.HandleFunc("/api/nodes", s.handleGetNodes)
	s.mux.HandleFunc("/api/cluster/ring", s.handleGetRing)
	s.mux.HandleFunc("/api/cluster/keys", s.handleGetClusterKeys)
	s.mux.HandleFunc("/api/events/history", s.handleEventHistory)
	s.mux.HandleFunc("/api/chaos", s.handleChaos)
	s.mux.HandleFunc("/api/ai/chat", s.handleAIChat)
	s.mux.HandleFunc("/api/keys", s.handleAPIKeys)
	s.mux.HandleFunc("/api/node/", s.handleNodeDetails)
	s.mux.HandleFunc("/api/debug/gossip", s.handleDebugGossip)

	// Serve Static Files
	fs := http.FileServer(http.Dir("web/dist"))
	s.mux.Handle("/", fs)
}

func (s *Server) handleKeys(w http.ResponseWriter, r *http.Request) {
	key := r.URL.Path[len("/keys/"):]
	if len(key) == 0 {
		http.Error(w, "key required", http.StatusBadRequest)
		return
	}

	consistency := r.Header.Get("X-Consistency")
	if consistency == "" {
		consistency = "quorum"
	}

	switch r.Method {
	case http.MethodGet:
		s.handleGet(w, r, key, consistency)
	case http.MethodPut:
		s.handlePut(w, r, key, consistency)
	case http.MethodDelete:
		s.handleDelete(w, r, key, consistency)
	default:
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
	}
}

func (s *Server) handleGet(w http.ResponseWriter, r *http.Request, key, consistency string) {
	opsTotal.WithLabelValues("read").Inc()

	val, err := s.coord.Read(r.Context(), key, consistency)
	if err != nil {
		switch {
		case errors.Is(err, coordinator.ErrNoNodes):
			http.Error(w, err.Error(), http.StatusServiceUnavailable)
		case errors.Is(err, coordinator.ErrQuorumFailed):
			http.Error(w, err.Error(), http.StatusServiceUnavailable)
		case errors.Is(err, coordinator.ErrNotFound):
			http.Error(w, err.Error(), http.StatusNotFound)
		default:
			http.Error(w, err.Error(), http.StatusInternalServerError)
		}
		return
	}

	w.Header().Set("Content-Type", "application/octet-stream")
	w.Write(val)
}

func (s *Server) handlePut(w http.ResponseWriter, r *http.Request, key, consistency string) {
	opsTotal.WithLabelValues("write").Inc()

	val, err := io.ReadAll(r.Body)
	if err != nil {
		http.Error(w, "bad request", http.StatusBadRequest)
		return
	}

	if err := s.coord.Write(r.Context(), key, val, consistency); err != nil {
		switch {
		case errors.Is(err, coordinator.ErrNoNodes):
			http.Error(w, err.Error(), http.StatusServiceUnavailable)
		case errors.Is(err, coordinator.ErrQuorumFailed):
			http.Error(w, err.Error(), http.StatusServiceUnavailable)
		default:
			http.Error(w, err.Error(), http.StatusInternalServerError)
		}
		return
	}

	w.WriteHeader(http.StatusCreated)
}

func (s *Server) handleDelete(w http.ResponseWriter, r *http.Request, key, consistency string) {
	opsTotal.WithLabelValues("delete").Inc()

	if err := s.coord.Delete(r.Context(), key, consistency); err != nil {
		switch {
		case errors.Is(err, coordinator.ErrNoNodes):
			http.Error(w, err.Error(), http.StatusServiceUnavailable)
		case errors.Is(err, coordinator.ErrQuorumFailed):
			http.Error(w, err.Error(), http.StatusServiceUnavailable)
		default:
			http.Error(w, err.Error(), http.StatusInternalServerError)
		}
		return
	}

	w.WriteHeader(http.StatusOK)
}

func (s *Server) handleAPIKeys(w http.ResponseWriter, r *http.Request) {
	switch r.Method {
	case http.MethodGet:
		key := r.URL.Query().Get("key")
		consistency := r.URL.Query().Get("consistency")
		if consistency == "" {
			consistency = "quorum"
		}
		if key == "" {
			http.Error(w, "key required", http.StatusBadRequest)
			return
		}
		val, err := s.coord.Read(r.Context(), key, consistency)
		if err != nil {
			if errors.Is(err, coordinator.ErrNotFound) {
				http.Error(w, "not found", http.StatusNotFound)
			} else {
				http.Error(w, err.Error(), http.StatusInternalServerError)
			}
			return
		}
		json.NewEncoder(w).Encode(map[string]string{"key": key, "value": string(val)})

	case http.MethodPost:
		var req struct {
			Key         string `json:"key"`
			Value       string `json:"value"`
			Consistency string `json:"consistency"`
		}
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			http.Error(w, err.Error(), http.StatusBadRequest)
			return
		}
		if req.Consistency == "" {
			req.Consistency = "quorum"
		}
		if err := s.coord.Write(r.Context(), req.Key, []byte(req.Value), req.Consistency); err != nil {
			http.Error(w, err.Error(), http.StatusInternalServerError)
			return
		}
		w.WriteHeader(http.StatusCreated)

	default:
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
	}
}

func (s *Server) handleWS(w http.ResponseWriter, r *http.Request) {
	conn, err := upgrader.Upgrade(w, r, nil)
	if err != nil {
		slog.Error("WebSocket upgrade failed", "error", err)
		return
	}
	defer conn.Close()

	eventCh := s.events.Subscribe()
	defer s.events.Unsubscribe(eventCh)

	stopCh := make(chan struct{})
	var mu sync.Mutex

	// Read loop (to detect closure)
	go func() {
		for {
			if _, _, err := conn.ReadMessage(); err != nil {
				close(stopCh)
				return
			}
		}
	}()

	// Write loop
	ticker := time.NewTicker(30 * time.Second)
	defer ticker.Stop()

	for {
		select {
		case event := <-eventCh:
			mu.Lock()
			if err := conn.WriteJSON(event); err != nil {
				mu.Unlock()
				return
			}
			mu.Unlock()
		case <-ticker.C:
			mu.Lock()
			if err := conn.WriteMessage(websocket.PingMessage, nil); err != nil {
				mu.Unlock()
				return
			}
			mu.Unlock()
		case <-stopCh:
			return
		}
	}
}

func (s *Server) handleGetRing(w http.ResponseWriter, r *http.Request) {
	ringState := s.coord.Ring().GetSnapshot()
	json.NewEncoder(w).Encode(ringState)
}

func (s *Server) handleGetClusterKeys(w http.ResponseWriter, r *http.Request) {
	keys, err := s.coord.ListClusterKeys(r.Context())
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	json.NewEncoder(w).Encode(keys)
}

func (s *Server) handleGetNodes(w http.ResponseWriter, r *http.Request) {
	nodes := s.coord.Ring().GetAllNodes()
	metrics := s.metrics.GetSnapshot()

	resp := map[string]interface{}{
		"nodes":   nodes,
		"metrics": metrics,
	}
	json.NewEncoder(w).Encode(resp)
}

func (s *Server) handleEventHistory(w http.ResponseWriter, r *http.Request) {
	history := s.events.GetHistory()
	json.NewEncoder(w).Encode(history)
}

func (s *Server) handleChaos(w http.ResponseWriter, r *http.Request) {
	if r.Method == http.MethodGet {
		json.NewEncoder(w).Encode(s.coord.GetChaos())
		return
	}

	if r.Method == http.MethodPost {
		var req struct {
			Latency string `json:"latency"`
			Killed  bool   `json:"killed"`
		}
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			http.Error(w, err.Error(), http.StatusBadRequest)
			return
		}
		dur, _ := time.ParseDuration(req.Latency)
		s.coord.SetChaos(dur, req.Killed)
		w.WriteHeader(http.StatusOK)
		return
	}
	http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
}

func (s *Server) handleAIChat(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	if s.ai == nil {
		http.Error(w, "AI engine not configured", http.StatusServiceUnavailable)
		return
	}

	var req struct {
		Message string `json:"message"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	// SSE implementation for AI streaming
	w.Header().Set("Content-Type", "text/event-stream")
	w.Header().Set("Cache-Control", "no-cache")
	w.Header().Set("Connection", "keep-alive")

	flusher, ok := w.(http.Flusher)
	if !ok {
		http.Error(w, "Streaming unsupported", http.StatusInternalServerError)
		return
	}

	out := make(chan string)
	ctx, cancel := context.WithCancel(r.Context())
	defer cancel()

	go func() {
		defer close(out)
		if err := s.ai.Chat(ctx, req.Message, out); err != nil {
			slog.Error("AI chat error", "error", err)
		}
	}()

	for text := range out {
		fmt.Fprintf(w, "data: %s\n\n", text)
		flusher.Flush()
	}
}

func (s *Server) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	s.mux.ServeHTTP(w, r)
}
func (s *Server) handleDebugGossip(w http.ResponseWriter, r *http.Request) {
	json.NewEncoder(w).Encode(s.coord.GetGossipState())
}

func (s *Server) handleNodeDetails(w http.ResponseWriter, r *http.Request) {
	nodeID := r.URL.Path[len("/api/node/"):]
	if nodeID == "" {
		http.Error(w, "node id required", http.StatusBadRequest)
		return
	}
	details := s.coord.GetNodeDetails(nodeID)
	json.NewEncoder(w).Encode(details)
}
