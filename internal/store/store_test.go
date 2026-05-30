package store

import (
	"os"
	"reflect"
	"testing"
	"time"
)

func TestEngine(t *testing.T) {
	dbPath := "test.db"
	walPath := "test.wal"

	defer os.Remove(dbPath)
	defer os.Remove(walPath)

	engine, err := NewEngine(dbPath, walPath)
	if err != nil {
		t.Fatalf("failed to create engine: %v", err)
	}

	key := []byte("hello")
	val := []byte("world")

	// Test Set
	if err := engine.Set(key, val); err != nil {
		t.Fatalf("failed to set key: %v", err)
	}

	// Test Get
	got, err := engine.Get(key)
	if err != nil {
		t.Fatalf("failed to get key: %v", err)
	}
	if !reflect.DeepEqual(got, val) {
		t.Errorf("got %s, want %s", got, val)
	}

	// Test Delete
	if err := engine.Delete(key); err != nil {
		t.Fatalf("failed to delete key: %v", err)
	}

	// Test Get after Delete
	_, err = engine.Get(key)
	if err != ErrKeyNotFound {
		t.Errorf("expected ErrKeyNotFound, got: %v", err)
	}

	engine.Close()
}

func TestEngineTTL(t *testing.T) {
	dbPath := "test_ttl.db"
	walPath := "test_ttl.wal"

	defer os.Remove(dbPath)
	defer os.Remove(walPath)

	engine, err := NewEngine(dbPath, walPath)
	if err != nil {
		t.Fatalf("failed to create engine: %v", err)
	}
	defer engine.Close()

	key := []byte("ephemeral")
	val := []byte("poof")

	// Set with 100ms TTL
	if err := engine.SetWithTTL(key, val, 100*time.Millisecond); err != nil {
		t.Fatalf("failed to set with ttl: %v", err)
	}

	// Immediate Get should pass
	if _, err := engine.Get(key); err != nil {
		t.Fatalf("expected key to exist: %v", err)
	}

	// Wait 150ms and Get should fail
	time.Sleep(150 * time.Millisecond)
	if _, err := engine.Get(key); err != ErrKeyNotFound {
		t.Fatalf("expected key to be expired, got: %v", err)
	}
}

func TestWALReplay(t *testing.T) {
	dbPath := "test_replay.db"
	walPath := "test_replay.wal"

	defer os.Remove(dbPath)
	defer os.Remove(walPath)

	engine, err := NewEngine(dbPath, walPath)
	if err != nil {
		t.Fatalf("failed to create engine: %v", err)
	}

	key := []byte("survivor")
	val := []byte("data")

	if err := engine.Set(key, val); err != nil {
		t.Fatalf("failed to set: %v", err)
	}
	engine.Close()

	// Clear bbolt to force state restoration from WAL
	os.Remove(dbPath)

	engine2, err := NewEngine(dbPath, walPath)
	if err != nil {
		t.Fatalf("failed to reopen engine: %v", err)
	}
	defer engine2.Close()

	got, err := engine2.Get(key)
	if err != nil {
		t.Fatalf("failed to get replayed key: %v", err)
	}
	if string(got) != string(val) {
		t.Errorf("got %s, want %s", got, val)
	}
}
