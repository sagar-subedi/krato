# krato User Guide

Welcome to Krato! Krato is a high-performance distributed key-value database. 

## Getting Started

### Starting the Node
Ensure you have built the source layout directly. Start an instance of the storage node locally via:
```bash
./bin/node --http=18080
```
This automatically scaffolds an underlying `krato.db` and matching write-ahead log (`krato.wal`) within the local execution directory.

### Running a Cluster via Docker
You can easily spin up a 3-node localized cluster utilizing Docker Compose.
```bash
docker-compose up --build
```
Krato instances will natively bind and share network limits internally resolving nodes automatically targeting HTTP ports `18080`, `18081` and `18082`.

### CLI Client Usage

The Krato API can be interacted with directly using our CLI tool cross boundary.

**Set a Value**
```bash
./bin/krato set <key> <value>
# Example: ./bin/krato set myKey "hello!"
```

**Retrieve a Value**
```bash
./bin/krato get <key>
# Example: ./bin/krato get myKey
```

**Delete a Value**
```bash
./bin/krato delete <key>
# Example: ./bin/krato delete myKey
```

## Fault Tolerance 
Krato natively relies on an internal synchronous Write Ahead Log prior to finalizing persistence logic in `bbolt`. 
This allows explicit protection from SIGKILL failures during hardware drops natively. 
To replicate a full disaster scenario, close processes locally, force delete `krato.db`, and run the `./bin/node` payload again! The application will dynamically read the `.wal` file reconstructing entire data graphs seamlessly restoring everything directly!
