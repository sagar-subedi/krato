package store

import (
	"encoding/binary"
	"encoding/json"
	"fmt"
	"io"
	"os"
	"sync"
)

type Operation string

const (
	OpSet    Operation = "SET"
	OpDelete Operation = "DELETE"
)

type LogEntry struct {
	Op        Operation `json:"op"`
	Key       []byte    `json:"key"`
	Value     []byte    `json:"value,omitempty"`
	ExpiresAt int64     `json:"expires_at,omitempty"`
}

type WAL struct {
	mu   sync.Mutex
	file *os.File
}

func NewWAL(path string) (*WAL, error) {
	f, err := os.OpenFile(path, os.O_APPEND|os.O_CREATE|os.O_WRONLY, 0644)
	if err != nil {
		return nil, fmt.Errorf("failed to open WAL file: %w", err)
	}
	return &WAL{file: f}, nil
}

func (w *WAL) Append(entry LogEntry) error {
	w.mu.Lock()
	defer w.mu.Unlock()

	data, err := json.Marshal(entry)
	if err != nil {
		return err
	}

	var lengthPrefix [4]byte
	binary.LittleEndian.PutUint32(lengthPrefix[:], uint32(len(data)))

	if _, err := w.file.Write(lengthPrefix[:]); err != nil {
		return err
	}
	if _, err := w.file.Write(data); err != nil {
		return err
	}

	return w.file.Sync()
}

func (w *WAL) Close() error {
	w.mu.Lock()
	defer w.mu.Unlock()
	return w.file.Close()
}

func ReplayWAL(path string, applyFn func(LogEntry) error) error {
	f, err := os.Open(path)
	if err != nil {
		if os.IsNotExist(err) {
			return nil
		}
		return fmt.Errorf("failed to open WAL for replay: %w", err)
	}
	defer f.Close()

	for {
		var lengthPrefix [4]byte
		_, err := io.ReadFull(f, lengthPrefix[:])
		if err == io.EOF {
			break
		}
		if err != nil {
			return fmt.Errorf("failed to read length prefix: %w", err)
		}

		length := binary.LittleEndian.Uint32(lengthPrefix[:])
		data := make([]byte, length)
		if _, err := io.ReadFull(f, data); err != nil {
			return fmt.Errorf("failed to read entry data: %w", err)
		}

		var entry LogEntry
		if err := json.Unmarshal(data, &entry); err != nil {
			return fmt.Errorf("failed to unmarshal entry: %w", err)
		}

		if err := applyFn(entry); err != nil {
			return fmt.Errorf("failed to apply entry: %w", err)
		}
	}
	return nil
}
