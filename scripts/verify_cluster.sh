#!/bin/bash

# Ensure docker is spinning active workloads natively.
if ! command -v docker-compose &> /dev/null
then
    echo "Docker Compose is required to run automated evaluations."
    exit 1
fi

echo "Building Krato components natively..."
make build

echo "Starting 3-Node Local Cluster..."
make cluster-up

echo "Allowing Gossip Protocol metrics to secure topologies (5 seconds)..."
sleep 5

echo "------------------------------------------------------"
echo "VERIFICATION 1: Routing & Quorums"
echo "> Setting 'fruit=apple' against Node1 (Port 8080)"
./bin/krato-cli --api="http://localhost:8080" set fruit apple

echo "> Reading 'fruit' back from Node3 (Port 8082) seamlessly mapping Coordinator routers."
./bin/krato-cli --api="http://localhost:8082" get fruit
echo ""

echo "------------------------------------------------------"
echo "VERIFICATION 2: Native Telemetry metrics"
echo "> Fetching prometheus parameters mapped at Node2 (Port 8081)"
curl -s http://localhost:8081/metrics | grep -E "^krato"
echo ""

echo "------------------------------------------------------"
echo "All done! Tear down cluster using 'make cluster-down'"
echo "Test the AI Administrator natively executing 'export GEMINI_API_KEY=... && ./bin/krato-cli ai'"
