package main

import (
	"context"
	flag "github.com/spf13/pflag"
	"log/slog"
	"net"
	"net/http"
	"os"
	"os/signal"
	"strings"
	"syscall"
	"time"

	"github.com/spf13/viper"
	"github.com/sagarsubedi/krato/internal/api"
	"github.com/sagarsubedi/krato/internal/gossip"
	"github.com/sagarsubedi/krato/internal/ring"
	kratorpc "github.com/sagarsubedi/krato/internal/rpc"
	"github.com/sagarsubedi/krato/internal/store"
	"google.golang.org/grpc"
)

func main() {
	slog.SetDefault(slog.New(slog.NewJSONHandler(os.Stdout, nil)))

	flag.String("id", "node1", "unique node ID")
	flag.String("db", "krato.db", "path to bbolt database")
	flag.String("wal", "krato.wal", "path to write-ahead log")
	flag.String("http", "8080", "HTTP API port")
	flag.String("grpc", "9090", "gRPC port")
	flag.String("gossip", "7070", "UDP Gossip port")
	flag.String("advertise", "localhost", "Address to advertise to cluster")
	flag.String("seeds", "", "comma separated explicit gossip seed addresses")

	flag.Parse()

	viper.SetEnvPrefix("KRATO")
	viper.AutomaticEnv()
	viper.BindPFlags(flag.CommandLine)

	viper.SetConfigName("krato")
	viper.SetConfigType("yaml")
	viper.AddConfigPath(".")
	viper.AddConfigPath("/etc/krato/")
	if err := viper.ReadInConfig(); err != nil {
		slog.Debug("No config file located, utilizing explicit variables.")
	}

	// Refresh variables from viper context enabling ENV limits safely.
	nodeIDVal := viper.GetString("id")
	dbPathVal := viper.GetString("db")
	walPathVal := viper.GetString("wal")
	grpcPortVal := viper.GetString("grpc")
	gossipPortVal := viper.GetString("gossip")
	httpPortVal := viper.GetString("http")
	seedsVal := viper.GetString("seeds")
	advertiseVal := viper.GetString("advertise")

	engine, err := store.NewEngine(dbPathVal, walPathVal)
	if err != nil {
		slog.Error("failed to open store engine", "error", err)
		os.Exit(1)
	}
	defer engine.Close()

	hashRing := ring.NewHashRing(150)
	hashRing.AddNode(ring.Node{ID: nodeIDVal, Address: advertiseVal + ":" + grpcPortVal})

	// Start Gossip Protocol
	ringCh := make(chan gossip.MemberEvent, 100)
	gossiper, err := gossip.NewGossiper(nodeIDVal, "0.0.0.0:"+gossipPortVal, advertiseVal + ":" + grpcPortVal, ringCh)
	if err != nil {
		slog.Error("failed to configure gossip", "error", err)
		os.Exit(1)
	}

	seedList := strings.Split(seedsVal, ",")
	validSeeds := make([]string, 0)
	for _, s := range seedList {
		if s != "" {
			validSeeds = append(validSeeds, s)
		}
	}
	gossiper.Start(validSeeds)
	defer gossiper.Stop()

	go func() {
		for event := range ringCh {
			if event.IsJoin {
				slog.Info("Node joined ring", "id", event.Member.ID, "grpc", event.Member.GrpcAddress)
				hashRing.AddNode(ring.Node{ID: event.Member.ID, Address: event.Member.GrpcAddress})
			} else if event.IsDead {
				slog.Info("Node left ring", "id", event.Member.ID)
				hashRing.RemoveNode(event.Member.ID)
			}
		}
	}()

	grpcServer := grpc.NewServer()
	nodeServer := kratorpc.NewNodeServer(nodeIDVal, engine)
	kratorpc.RegisterNodeServiceServer(grpcServer, nodeServer)

	lis, err := net.Listen("tcp", ":"+grpcPortVal)
	if err != nil {
		slog.Error("failed to listen on gRPC port", "error", err)
		os.Exit(1)
	}

	go func() {
		slog.Info("Starting Krato gRPC server", "port", grpcPortVal)
		if err := grpcServer.Serve(lis); err != nil {
			slog.Error("gRPC server failed", "error", err)
		}
	}()

	srv := api.NewServer(nodeIDVal, engine, hashRing)

	httpServer := &http.Server{
		Addr:    ":" + httpPortVal,
		Handler: srv,
	}

	go func() {
		slog.Info("Starting Krato HTTP server", "port", httpPortVal)
		if err := httpServer.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			slog.Error("HTTP server failed", "error", err)
			os.Exit(1)
		}
	}()

	srv.StartAntiEntropy()

	quit := make(chan os.Signal, 1)
	signal.Notify(quit, os.Interrupt, syscall.SIGTERM)
	<-quit
	slog.Info("Shutting down Krato node...")

	grpcServer.GracefulStop()

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	if err := httpServer.Shutdown(ctx); err != nil {
		slog.Error("HTTP Server forced to shutdown", "error", err)
		os.Exit(1)
	}
	slog.Info("Node stopped gracefully.")
}
