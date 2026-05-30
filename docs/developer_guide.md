# krato Developer Guide

## Overview
Krato is a distributed key-value store crafted in Go. It relies on a consistent hash ring for partition distribution, a gossip-based membership protocol for cluster discovery, tunable replication for consistency, and features an integrated AI-powered agent.

## Architecture Structure (Phase 1 & Phase 2)
- `cmd/node`: Entry point for the Krato storage node daemon. Includes HTTP Coordinator and gRPC handlers.
- `cmd/cli`: Entry point for the CLI client.
- `internal/store`: Defines the foundational datastore traits.
  - **BoltStore**: Core persistency logic built upon `go.etcd.io/bbolt`.
  - **Write-Ahead Log (WAL)**: Ensures crash persistence by flushing operations via encoded byte logs before DB updates.
  - **Engine**: The encompassing construct integrating WAL, BoltStore, and TTL sweeping routines.
- `internal/api`: The internal HTTP server serving as the mesh API Edge/Coordinator processing requests.
- `internal/ring`: Defines a Consistent Hash Ring mapped utilizing `xxhash` supporting dynamic virtual node allocation scaling dynamically.
- `internal/rpc` & `proto`: Protobuf compilation output mapping core Node-to-Node communication pathways internally.

## Building the Project
To compile all necessary binaries into `bin/`:
```bash
make build
```

## Running Unit Tests
```bash
go test -v ./...
```
*(Tests cover generic datastore operations, active TTL eviction verification, and independent datastore recreation via WAL validation).*

## Core Data Types
- **LogEntry**: Operations serialized inside `krato.wal` using length-formatted JSON arrays detailing Op code, exact payload keys, nested values, and TTL parameters.
