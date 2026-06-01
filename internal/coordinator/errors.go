package coordinator

import "errors"

var (
	// ErrNoNodes is returned when the hash ring has no available nodes for the key.
	ErrNoNodes = errors.New("no available nodes in cluster")

	// ErrQuorumFailed is returned when insufficient replicas respond to meet quorum.
	ErrQuorumFailed = errors.New("quorum operation failed")

	// ErrNotFound is returned when the key does not exist on any replica.
	ErrNotFound = errors.New("not found")
)
