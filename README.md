# Krato (Distributed Key-Value Store)

Krato is a highly fault-tolerant dynamically distributed Key-Value store mapped entirely utilizing Go. It tackles advanced clustering metrics securely scaling native workloads entirely autonomously!

> **Note on Coordinator**: Krato operates completely decentralized. *Every node acts natively as a Coordinator!* When you talk to `Node 3`, but the data hashes to `Node 1`, Node 3 will automatically proxy the connection dynamically using native gRPC interfaces.

## 🚀 Quickstart (1-Minute Setup)

**1. Clone the repository**
```bash
git clone <your-repo>
cd krato
```

**2. Spin up the 3-node cluster natively** (requires Docker)
```bash
make cluster-up
```

**3. Compile the Krato CLI natively**
```bash
make build
```

## 🧪 Feature Verification Guide
Here is exactly how to verify all core features securely natively! Or run `make verify` for an automated demo.

### 1. Consistent Hash Ring & Coordination
**Test**: Send requests to any node, and see how properties map synchronously bridging native contexts!
```bash
# Set a value by sending to node 1 (18080)
./bin/krato-cli --api="http://localhost:18080" set fruit apple

# Read the value back from node 3 (18082) seamlessly!
# Node 3 coordinates the read internally querying the target partition natively!
./bin/krato-cli --api="http://localhost:18082" get fruit
```

### 2. N=3 Replication & Vector Clocks
**Test**: Set a value natively tracking vector consistency, then kill a node checking read-repairs!
1. Set a value (e.g. `vehicle=car`)
2. Use `docker-compose stop node2` to kill a node simulating an outage.
3. Fetch the data again (`./bin/krato-cli --api="http://localhost:18080" get vehicle`); the system returns successful boundaries maintaining Quorum (W=2 / R=2). 
4. Bring `node2` back (`docker-compose start node2`). Vector Clocks ensure active metrics automatically merge older metrics natively executing concurrent bounds autonomously matching explicitly via read-repair scripts dynamically.

### 3. Gossip Protocol
**Test**: Check the Docker logs to observe ALIVE and DEAD synchronizations explicitly over UDP!
1. Run `docker-compose logs -f`
2. Stop `node3` (`docker-compose stop node3`).
3. You will immediately see `node1` and `node2` log `node3` as `SUSPECT` then transitioning to `DEAD` natively, instantly updating their relative internal HashRings!

### 4. Krato AI Agent (Gemini Embed)
**Test**: Interact natively across the local network commanding boundaries automatically targeting constraints intelligently.
1. Connect cleanly starting the native CLI prompt. *(Supports standard schema JSON toolings resolving `read_key` and `write_key` functionalities locally.)*
```bash
export GEMINI_API_KEY="your_api_key_here"
./bin/krato-cli ai
```
2. Talk to it!
```
krato-ai> What is the current value of the key 'fruit'?
< The Agent invokes `read_key` natively querying your local cluster! >
krato-ai> Change it to 'orange' please!
< The Agent invokes `write_key` natively mapping parameters successfully! >
```

### 5. Prometheus Metrics
Monitor the active telemetry limits spanning ops structures dynamically!
```bash
curl http://localhost:18080/metrics | grep krato
```
