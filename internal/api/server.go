package api

import (
	"errors"
	"io"
	"net/http"

	"github.com/prometheus/client_golang/prometheus"
	"github.com/prometheus/client_golang/prometheus/promhttp"
	"github.com/sagarsubedi/krato/internal/coordinator"
)

var (
	opsTotal = prometheus.NewCounterVec(
		prometheus.CounterOpts{
			Name: "krato_ops_total",
			Help: "Total distributed operations processed by type.",
		},
		[]string{"op"},
	)
)

func init() {
	prometheus.MustRegister(opsTotal)
}

// Server is the HTTP API layer. It is deliberately thin, delegating all distributed
// logic to the Coordinator.
type Server struct {
	coord *coordinator.Coordinator
	mux   *http.ServeMux
}

// NewServer creates a new HTTP API server backed by the given Coordinator.
func NewServer(coord *coordinator.Coordinator) *Server {
	s := &Server{
		coord: coord,
		mux:   http.NewServeMux(),
	}
	s.routes()
	return s
}

func (s *Server) routes() {
	s.mux.HandleFunc("/keys/", s.handleKeys)
	s.mux.Handle("/metrics", promhttp.Handler())
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

func (s *Server) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	s.mux.ServeHTTP(w, r)
}
