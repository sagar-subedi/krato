package api

import (
	"context"
	"io"
	"net/http"
	"sync"
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
	if node.ID == s.nodeID {
		return nil
	}
	client, err := rpc.NewClient(node.Address)
	if err != nil {
		return err
	}
	s.rpcConns[node.ID] = client
	return nil
}

func (s *Server) StartAntiEntropy() {
	go func() {
		ticker := time.NewTicker(30 * time.Second)
		for range ticker.C {
			results, err := s.engine.Scan([]byte{})
			if err == nil {
				for keyBytes, val := range results {
					decodedVal, clock, err := store.DecodeVersionedValue(val)
					if err != nil {
						continue
					}
					nodes := s.ring.GetNodes(keyBytes, 3)
					for _, n := range nodes {
						if n.ID != s.nodeID {
							if c, ok := s.rpcConns[n.ID]; ok {
								c.Set(context.Background(), keyBytes, decodedVal, 0, clock)
							}
						}
					}
				}
			}
		}
	}()
}

func (s *Server) routes() {
	s.mux.HandleFunc("/keys/", s.handleKeys)
}

func (s *Server) handleKeys(w http.ResponseWriter, r *http.Request) {
	key := r.URL.Path[len("/keys/"):]
	if len(key) == 0 {
		http.Error(w, "key required", http.StatusBadRequest)
		return
	}

	nodes := s.ring.GetNodes(key, 3)
	if len(nodes) == 0 {
		http.Error(w, "no available nodes in cluster", http.StatusServiceUnavailable)
		return
	}

	consistency := r.Header.Get("X-Consistency")
	if consistency == "" {
		consistency = "quorum"
	}

	switch r.Method {
	case http.MethodGet:
		s.readQuorum(w, r, key, nodes, consistency)
	case http.MethodPut:
		s.writeQuorum(w, r, key, nodes, consistency)
	case http.MethodDelete:
		s.deleteQuorum(w, r, key, nodes, consistency)
	default:
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
	}
}

func (s *Server) readQuorum(w http.ResponseWriter, r *http.Request, key string, nodes []ring.Node, consistency string) {
	var W int
	if consistency == "async" {
		W = 1
	} else {
		W = len(nodes)/2 + 1
	}
	if W > len(nodes) {
		W = len(nodes)
	}

	ctx, cancel := context.WithTimeout(r.Context(), 2*time.Second)
	defer cancel()

	var wg sync.WaitGroup
	var mu sync.Mutex

	type readResult struct {
		val   []byte
		clock store.VectorClock
	}
	results := make([]readResult, 0, len(nodes))
	successes := 0

	for _, n := range nodes {
		wg.Add(1)
		go func(node ring.Node) {
			defer wg.Done()
			var val []byte
			var found bool
			var clock map[string]int64

			if node.ID == s.nodeID {
				localVal, err := s.engine.Get([]byte(key))
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
				client, exists := s.rpcConns[node.ID]
				if !exists {
					if err := s.ConnectPeer(node); err != nil {
						return
					}
					client = s.rpcConns[node.ID]
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
		http.Error(w, "quorum read failed", http.StatusServiceUnavailable)
		return
	}

	if len(results) == 0 {
		http.Error(w, "not found", http.StatusNotFound)
		return
	}

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

	for i, res := range results {
		if i != bestIndex && best.clock.Compare(res.clock) > 0 {
			go func(targetNode ring.Node) {
				if targetNode.ID == s.nodeID {
					s.engine.SetVersioned([]byte(key), best.val, best.clock, 0)
				} else {
					if c, ok := s.rpcConns[targetNode.ID]; ok {
						c.Set(context.Background(), key, best.val, 0, best.clock)
					}
				}
			}(nodes[i])
		}
	}

	w.Header().Set("Content-Type", "application/octet-stream")
	w.Write(best.val)
}

func (s *Server) writeQuorum(w http.ResponseWriter, r *http.Request, key string, nodes []ring.Node, consistency string) {
	val, err := io.ReadAll(r.Body)
	if err != nil {
		http.Error(w, "bad request", http.StatusBadRequest)
		return
	}

	var currentClock store.VectorClock
	if len(nodes) > 0 {
		n := nodes[0]
		if n.ID == s.nodeID {
			localVal, err := s.engine.Get([]byte(key))
			if err == nil {
				_, currentClock, _ = store.DecodeVersionedValue(localVal)
			}
		} else {
			if client, exists := s.rpcConns[n.ID]; exists {
				_, ok, clock, err := client.Get(context.Background(), key)
				if err == nil && ok {
					currentClock = clock
				}
			}
		}
	}
	if currentClock == nil {
		currentClock = store.NewVectorClock()
	}
	currentClock.Increment(s.nodeID)

	var W int
	if consistency == "async" {
		W = 1
	} else {
		W = len(nodes)/2 + 1
	}
	if W > len(nodes) {
		W = len(nodes)
	}

	ctx, cancel := context.WithTimeout(r.Context(), 2*time.Second)
	defer cancel()

	var wg sync.WaitGroup
	var mu sync.Mutex
	successes := 0

	for _, n := range nodes {
		wg.Add(1)
		go func(node ring.Node) {
			defer wg.Done()
			var err error
			if node.ID == s.nodeID {
				err = s.engine.SetVersioned([]byte(key), val, currentClock, 0)
			} else {
				client, exists := s.rpcConns[node.ID]
				if !exists {
					if errC := s.ConnectPeer(node); errC != nil {
						return
					}
					client = s.rpcConns[node.ID]
				}
				err = client.Set(ctx, key, val, 0, currentClock)
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
		http.Error(w, "quorum write failed", http.StatusServiceUnavailable)
		return
	}

	w.WriteHeader(http.StatusCreated)
}

func (s *Server) deleteQuorum(w http.ResponseWriter, r *http.Request, key string, nodes []ring.Node, consistency string) {
	var W int
	if consistency == "async" {
		W = 1
	} else {
		W = len(nodes)/2 + 1
	}
	if W > len(nodes) {
		W = len(nodes)
	}

	ctx, cancel := context.WithTimeout(r.Context(), 2*time.Second)
	defer cancel()

	var wg sync.WaitGroup
	var mu sync.Mutex
	successes := 0

	for _, n := range nodes {
		wg.Add(1)
		go func(node ring.Node) {
			defer wg.Done()
			var err error
			if node.ID == s.nodeID {
				err = s.engine.Delete([]byte(key))
			} else {
				client, exists := s.rpcConns[node.ID]
				if !exists {
					if errC := s.ConnectPeer(node); errC != nil {
						return
					}
					client = s.rpcConns[node.ID]
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
		http.Error(w, "quorum delete failed", http.StatusServiceUnavailable)
		return
	}

	w.WriteHeader(http.StatusOK)
}

func (s *Server) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	s.mux.ServeHTTP(w, r)
}
