package main

import (
	"context"
	"log/slog"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/sagarsubedi/krato/internal/config"
	"github.com/sagarsubedi/krato/internal/node"
)

func main() {
	slog.SetDefault(slog.New(slog.NewJSONHandler(os.Stdout, nil)))

	cfg, err := config.Load()
	if err != nil {
		slog.Error("failed to load configuration", "error", err)
		os.Exit(1)
	}

	app, err := node.NewApp(cfg)
	if err != nil {
		slog.Error("failed to initialize node", "error", err)
		os.Exit(1)
	}

	if err := app.Start(); err != nil {
		slog.Error("failed to start node", "error", err)
		os.Exit(1)
	}

	quit := make(chan os.Signal, 1)
	signal.Notify(quit, os.Interrupt, syscall.SIGTERM)
	<-quit

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	app.Shutdown(ctx)
}
