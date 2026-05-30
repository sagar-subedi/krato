package api

import (
	"context"
	"io"
	"net/http"
	"time"

	"github.com/sagarsubedi/krato/internal/ring"
	"github.com/sagarsubedi/krato/internal/rpc"
	"github.com/sagarsubedi/krato/internal/store"
)

type Server struct {
	engine   *store.Engine
	mux      *http.ServeMux
	ring     *ring.HashRing
	nodeID   string
	rpcConns map[string]*rpc.Client
}

func NewServer(nodeID string, engine *store.Engine, hashRing *ring.HashRing) *Server {
	s := &Server{
		engine:   engine,
		mux:      http.NewServeMux(),
		ring:     hashRing,
		nodeID:   nodeID,
		rpcConns: make(map[string]*rpc.Client),
	}
	s.routes()
	return s
}

func (s *Server) ConnectPeer(node ring.Node) error {
	client, err := rpc.NewClient(node.Address)
	if err != nil {
		return err
	}
	s.rpcConns[node.ID] = client
	return nil
}

func (s *Server) routes() {
	s.mux.HandleFunc("/keys/", s.handleKeys)
}

func (s *Server) handleKeys(w http.ResponseWriter, r *http.Request) {
	key := []byte(r.URL.Path[len("/keys/"):])
	if len(key) == 0 {
		http.Error(w, "key required", http.StatusBadRequest)
		return
	}

	node, ok := s.ring.GetNode(string(key))
	if !ok {
		http.Error(w, "no available nodes in cluster", http.StatusServiceUnavailable)
		return
	}

	if node.ID == s.nodeID {
		s.handleLocal(w, r, key)
		return
	}

	s.handleRemote(w, r, string(key), node)
}

func (s *Server) handleLocal(w http.ResponseWriter, r *http.Request, key []byte) {
	switch r.Method {
	case http.MethodGet:
		val, err := s.engine.Get(key)
		if err == store.ErrKeyNotFound {
			http.Error(w, "not found", http.StatusNotFound)
			return
		} else if err != nil {
			http.Error(w, err.Error(), http.StatusInternalServerError)
			return
		}
		w.Header().Set("Content-Type", "application/octet-stream")
		w.Write(val)

	case http.MethodPut:
		val, err := io.ReadAll(r.Body)
		if err != nil {
			http.Error(w, "bad request", http.StatusBadRequest)
			return
		}
		if err := s.engine.Set(key, val); err != nil {
			http.Error(w, err.Error(), http.StatusInternalServerError)
			return
		}
		w.WriteHeader(http.StatusCreated)

	case http.MethodDelete:
		if err := s.engine.Delete(key); err != nil {
			http.Error(w, err.Error(), http.StatusInternalServerError)
			return
		}
		w.WriteHeader(http.StatusOK)

	default:
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
	}
}

func (s *Server) handleRemote(w http.ResponseWriter, r *http.Request, key string, node ring.Node) {
	client, exists := s.rpcConns[node.ID]
	if !exists {
		if err := s.ConnectPeer(node); err != nil {
			http.Error(w, "remote node unreachable", http.StatusBadGateway)
			return
		}
		client = s.rpcConns[node.ID]
	}

	ctx, cancel := context.WithTimeout(r.Context(), 2*time.Second)
	defer cancel()

	switch r.Method {
	case http.MethodGet:
		val, found, err := client.Get(ctx, key)
		if err != nil {
			http.Error(w, err.Error(), http.StatusBadGateway)
			return
		}
		if !found {
			http.Error(w, "not found", http.StatusNotFound)
			return
		}
		w.Header().Set("Content-Type", "application/octet-stream")
		w.Write(val)

	case http.MethodPut:
		val, err := io.ReadAll(r.Body)
		if err != nil {
			http.Error(w, "bad request", http.StatusBadRequest)
			return
		}
		if err := client.Set(ctx, key, val, 0); err != nil {
			http.Error(w, err.Error(), http.StatusBadGateway)
			return
		}
		w.WriteHeader(http.StatusCreated)

	case http.MethodDelete:
		if err := client.Delete(ctx, key); err != nil {
			http.Error(w, err.Error(), http.StatusBadGateway)
			return
		}
		w.WriteHeader(http.StatusOK)

	default:
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
	}
}

func (s *Server) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	s.mux.ServeHTTP(w, r)
}
