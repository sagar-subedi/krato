#!/bin/bash

echo "Running Krato local benchmarks..."
if ! command -v wrk &> /dev/null
then
    echo "This script requires 'wrk' benchmarking tool. Please install it via your package manager."
    exit 1
fi

echo "--- Writing Data Throughput ---"
cat << 'EOF' > /tmp/post.lua
wrk.method = "PUT"
wrk.body = "benchmark-payload-data"
wrk.headers["Content-Type"] = "application/octet-stream"
EOF

wrk -t4 -c100 -d10s -s /tmp/post.lua http://localhost:8080/keys/benchkey

echo "--- Reading Data Throughput ---"
wrk -t4 -c100 -d10s http://localhost:8080/keys/benchkey

echo "Done!"
