package node

import (
	"context"
	"log/slog"
	"net"
	"net/http"
	"time"

	"github.com/sagarsubedi/krato/internal/api"
	"github.com/sagarsubedi/krato/internal/config"
	"github.com/sagarsubedi/krato/internal/coordinator"
	"github.com/sagarsubedi/krato/internal/genai"
	"github.com/sagarsubedi/krato/internal/gossip"
	"github.com/sagarsubedi/krato/internal/observe"
	"github.com/sagarsubedi/krato/internal/replication"
	"github.com/sagarsubedi/krato/internal/ring"
	kratorpc "github.com/sagarsubedi/krato/internal/rpc"
	"github.com/sagarsubedi/krato/internal/store"
	"google.golang.org/grpc"
)

// App encapsulates all Krato node components and manages their lifecycle.
type App struct {
	cfg         *config.Config
	engine      *store.Engine
	hashRing    *ring.HashRing
	gossiper    *gossip.Gossiper
	coord       *coordinator.Coordinator
	antiEntropy *replication.AntiEntropy
	events      *observe.EventBus
	metrics     *observe.Metrics
	ai          *genai.Engine
	grpcServer  *grpc.Server
	httpServer  *http.Server
}

// NewApp initializes all Krato components using the given Config.
func NewApp(cfg *config.Config) (*App, error) {
	engine, err := store.NewEngine(cfg.DBPath, cfg.WALPath)
	if err != nil {
		return nil, err
	}

	events := observe.NewEventBus(1000)
	metrics := observe.NewMetrics()

	hashRing := ring.NewHashRing(150)
	hashRing.AddNode(ring.Node{ID: cfg.ID, Address: cfg.Advertise + ":" + cfg.GRPCPort})

	// Gossip Protocol
	ringCh := make(chan gossip.MemberEvent, 100)
	gossiper, err := gossip.NewGossiper(cfg.ID, "0.0.0.0:"+cfg.GossipPort, cfg.Advertise+":"+cfg.GossipPort, cfg.Advertise+":"+cfg.GRPCPort, ringCh, events)
	if err != nil {
		engine.Close()
		return nil, err
	}

	coord := coordinator.NewCoordinator(cfg.ID, engine, hashRing, events, metrics, cfg.ReplicationFactor, gossiper)
	antiEntropy := replication.NewAntiEntropy(coord, 30*time.Second)

	// React to gossip membership events: update the hash ring and coordinator connections.
	go func() {
		for event := range ringCh {
			if event.IsJoin {
				slog.Info("Node joined ring", "id", event.Member.ID, "grpc", event.Member.GrpcAddress)
				hashRing.AddNode(ring.Node{ID: event.Member.ID, Address: event.Member.GrpcAddress})
				coord.ConnectPeer(ring.Node{ID: event.Member.ID, Address: event.Member.GrpcAddress})
				events.Publish(cfg.ID, observe.EventGossip, map[string]interface{}{
					"type": "join",
					"id":   event.Member.ID,
					"grpc": event.Member.GrpcAddress,
				})
			} else if event.IsDead {
				slog.Info("Node left ring", "id", event.Member.ID)
				hashRing.RemoveNode(event.Member.ID)
				events.Publish(cfg.ID, observe.EventGossip, map[string]interface{}{
					"type": "leave",
					"id":   event.Member.ID,
				})
			}
		}
	}()

	// Initialize GenAI Engine (if key exists)
	var aiEngine *genai.Engine
	if cfg.GeminiKey != "" {
		var err error
		aiEngine, err = genai.NewEngine(context.Background(), cfg.GeminiKey, coord, events, metrics)
		if err != nil {
			slog.Warn("Failed to initialize AI engine", "error", err)
		}
	}

	// gRPC server
	grpcServer := grpc.NewServer()
	nodeServer := kratorpc.NewNodeServer(cfg.ID, engine)
	kratorpc.RegisterNodeServiceServer(grpcServer, nodeServer)

	// HTTP API server
	apiServer := api.NewServer(coord, events, metrics, aiEngine)
	httpServer := &http.Server{
		Addr:    ":" + cfg.HTTPPort,
		Handler: apiServer,
	}

	return &App{
		cfg:         cfg,
		engine:      engine,
		hashRing:    hashRing,
		gossiper:    gossiper,
		coord:       coord,
		antiEntropy: antiEntropy,
		events:      events,
		metrics:     metrics,
		ai:          aiEngine,
		grpcServer:  grpcServer,
		httpServer:  httpServer,
	}, nil
}

// Start launches all node services (gRPC, HTTP, Gossip, Anti-Entropy).
func (a *App) Start() error {
	// Start gRPC listener
	lis, err := net.Listen("tcp", ":"+a.cfg.GRPCPort)
	if err != nil {
		return err
	}

	go func() {
		slog.Info("Starting Krato gRPC server", "port", a.cfg.GRPCPort)
		if err := a.grpcServer.Serve(lis); err != nil {
			slog.Error("gRPC server failed", "error", err)
		}
	}()

	// Start HTTP server
	go func() {
		slog.Info("Starting Krato HTTP server", "port", a.cfg.HTTPPort)
		if err := a.httpServer.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			slog.Error("HTTP server failed", "error", err)
		}
	}()

	// Start Gossip
	a.gossiper.Start(a.cfg.Seeds)

	// Start Anti-Entropy
	a.antiEntropy.Start()

	return nil
}

// Shutdown gracefully stops all node services in the correct dependency order.
func (a *App) Shutdown(ctx context.Context) {
	slog.Info("Shutting down Krato node...")

	a.antiEntropy.Stop()
	a.gossiper.Stop()
	if a.ai != nil {
		a.ai.Close()
	}
	a.grpcServer.GracefulStop()

	if err := a.httpServer.Shutdown(ctx); err != nil {
		slog.Error("HTTP server forced to shutdown", "error", err)
	}

	if err := a.engine.Close(); err != nil {
		slog.Error("Engine close failed", "error", err)
	}

	slog.Info("Node stopped gracefully.")
}
