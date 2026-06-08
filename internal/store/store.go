package store

import (
	"bytes"
	"encoding/binary"
	"errors"
	"fmt"
	"time"

	"go.etcd.io/bbolt"
)

var (
	ErrKeyNotFound = errors.New("key not found")
	defaultBucket  = []byte("krato_kv")
	ttlBucket      = []byte("krato_ttl")
)

// Store defines the interface for the key-value database
type Store interface {
	Get(key []byte) ([]byte, error)
	Set(key, value []byte) error
	SetWithTTL(key, value []byte, expiresAt int64) error
	Delete(key []byte) error
	Scan(prefix []byte) (map[string][]byte, error)
	Count() (int, error)
	Close() error
}

// BoltStore is a bbolt backed implementation of Store
type BoltStore struct {
	db *bbolt.DB
}

// NewBoltStore initializes a new bbolt database
func NewBoltStore(path string) (*BoltStore, error) {
	db, err := bbolt.Open(path, 0600, &bbolt.Options{Timeout: 1 * time.Second})
	if err != nil {
		return nil, fmt.Errorf("failed to open bbolt: %w", err)
	}

	err = db.Update(func(tx *bbolt.Tx) error {
		if _, err := tx.CreateBucketIfNotExists(defaultBucket); err != nil {
			return err
		}
		if _, err := tx.CreateBucketIfNotExists(ttlBucket); err != nil {
			return err
		}
		return nil
	})
	if err != nil {
		return nil, fmt.Errorf("failed to create bucket: %w", err)
	}

	return &BoltStore{db: db}, nil
}

func (s *BoltStore) Get(key []byte) ([]byte, error) {
	var val []byte
	err := s.db.Update(func(tx *bbolt.Tx) error {
		b := tx.Bucket(defaultBucket)
		tb := tx.Bucket(ttlBucket)

		expBytes := tb.Get(key)
		if expBytes != nil {
			expiresAt := int64(binary.BigEndian.Uint64(expBytes))
			if time.Now().UnixNano() > expiresAt {
				b.Delete(key)
				tb.Delete(key)
				return ErrKeyNotFound
			}
		}

		v := b.Get(key)
		if v == nil {
			return ErrKeyNotFound
		}
		val = make([]byte, len(v))
		copy(val, v)
		return nil
	})
	return val, err
}

func (s *BoltStore) Set(key, value []byte) error {
	return s.SetWithTTL(key, value, 0)
}

func (s *BoltStore) SetWithTTL(key, value []byte, expiresAt int64) error {
	return s.db.Update(func(tx *bbolt.Tx) error {
		b := tx.Bucket(defaultBucket)
		tb := tx.Bucket(ttlBucket)
		if err := b.Put(key, value); err != nil {
			return err
		}
		if expiresAt > 0 {
			expBytes := make([]byte, 8)
			binary.BigEndian.PutUint64(expBytes, uint64(expiresAt))
			return tb.Put(key, expBytes)
		} else {
			tb.Delete(key)
		}
		return nil
	})
}

func (s *BoltStore) Delete(key []byte) error {
	return s.db.Update(func(tx *bbolt.Tx) error {
		tx.Bucket(ttlBucket).Delete(key)
		return tx.Bucket(defaultBucket).Delete(key)
	})
}

func (s *BoltStore) Scan(prefix []byte) (map[string][]byte, error) {
	results := make(map[string][]byte)
	err := s.db.Update(func(tx *bbolt.Tx) error {
		b := tx.Bucket(defaultBucket)
		tb := tx.Bucket(ttlBucket)
		c := b.Cursor()
		now := time.Now().UnixNano()

		for k, v := c.Seek(prefix); k != nil && bytes.HasPrefix(k, prefix); k, v = c.Next() {
			expBytes := tb.Get(k)
			if expBytes != nil {
				expiresAt := int64(binary.BigEndian.Uint64(expBytes))
				if now > expiresAt {
					b.Delete(k)
					tb.Delete(k)
					continue
				}
			}

			valCopy := make([]byte, len(v))
			copy(valCopy, v)
			results[string(k)] = valCopy
		}
		return nil
	})
	return results, err
}

func (s *BoltStore) Sweep() error {
	now := time.Now().UnixNano()
	return s.db.Update(func(tx *bbolt.Tx) error {
		b := tx.Bucket(defaultBucket)
		tb := tx.Bucket(ttlBucket)

		c := tb.Cursor()
		for k, v := c.First(); k != nil; k, v = c.Next() {
			expiresAt := int64(binary.BigEndian.Uint64(v))
			if now > expiresAt {
				b.Delete(k)
				tb.Delete(k)
			}
		}
		return nil
	})
}

func (s *BoltStore) Count() (int, error) {
	var count int
	err := s.db.View(func(tx *bbolt.Tx) error {
		b := tx.Bucket(defaultBucket)
		count = b.Stats().KeyN
		return nil
	})
	return count, err
}

func (s *BoltStore) Close() error {
	return s.db.Close()
}
