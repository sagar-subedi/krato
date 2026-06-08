package store

import (
	"fmt"
	"time"
)

// Engine groups bbolt storage and Write-Ahead logging
type Engine struct {
	db   *BoltStore
	wal  *WAL
	quit chan struct{}
}

func NewEngine(dbPath, walPath string) (*Engine, error) {
	db, err := NewBoltStore(dbPath)
	if err != nil {
		return nil, err
	}

	wal, err := NewWAL(walPath)
	if err != nil {
		db.Close()
		return nil, err
	}

	e := &Engine{
		db:   db,
		wal:  wal,
		quit: make(chan struct{}),
	}

	// Replay WAL on startup to restore state
	err = ReplayWAL(walPath, func(entry LogEntry) error {
		switch entry.Op {
		case OpSet:
			return e.db.SetWithTTL(entry.Key, entry.Value, entry.ExpiresAt)
		case OpDelete:
			return e.db.Delete(entry.Key)
		}
		return nil
	})
	if err != nil {
		e.Close()
		return nil, fmt.Errorf("failed to replay WAL: %w", err)
	}

	go e.sweeperLoop()

	return e, nil
}

func (e *Engine) sweeperLoop() {
	ticker := time.NewTicker(1 * time.Minute)
	defer ticker.Stop()
	for {
		select {
		case <-ticker.C:
			e.db.Sweep()
		case <-e.quit:
			return
		}
	}
}

func (e *Engine) Get(key []byte) ([]byte, error) {
	return e.db.Get(key)
}

func (e *Engine) Set(key, value []byte) error {
	return e.SetWithTTL(key, value, 0)
}

func (e *Engine) SetWithTTL(key, value []byte, ttl time.Duration) error {
	var expiresAt int64
	if ttl > 0 {
		expiresAt = time.Now().Add(ttl).UnixNano()
	}
	if err := e.wal.Append(LogEntry{Op: OpSet, Key: key, Value: value, ExpiresAt: expiresAt}); err != nil {
		return err
	}
	return e.db.SetWithTTL(key, value, expiresAt)
}

func (e *Engine) SetVersioned(key, value []byte, clock VectorClock, ttl time.Duration) error {
	existingVal, err := e.db.Get(key)
	if err == nil {
		_, existingClock, err2 := DecodeVersionedValue(existingVal)
		if err2 == nil {
			if existingClock.Compare(clock) > 0 {
				return nil
			}
			clock.Merge(existingClock)
		}
	}

	encoded, err := EncodeVersionedValue(value, clock)
	if err != nil {
		return err
	}

	var expiresAt int64
	if ttl > 0 {
		expiresAt = time.Now().Add(ttl).UnixNano()
	}
	if err := e.wal.Append(LogEntry{Op: OpSet, Key: key, Value: encoded, ExpiresAt: expiresAt}); err != nil {
		return err
	}
	return e.db.SetWithTTL(key, encoded, expiresAt)
}

func (e *Engine) Delete(key []byte) error {
	if err := e.wal.Append(LogEntry{Op: OpDelete, Key: key}); err != nil {
		return err
	}
	return e.db.Delete(key)
}

func (e *Engine) Scan(prefix []byte) (map[string][]byte, error) {
	return e.db.Scan(prefix)
}

func (e *Engine) Count() (int, error) {
	return e.db.Count()
}

func (e *Engine) Close() error {
	close(e.quit)
	e.wal.Close()
	return e.db.Close()
}
