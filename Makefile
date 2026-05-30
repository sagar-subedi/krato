.PHONY: build test clean run-node run-cli

build:
	go build -o bin/node ./cmd/node
	go build -o bin/coordinator ./cmd/coordinator
	go build -o bin/krato ./cmd/cli

test:
	go test -v ./...

clean:
	rm -rf bin/

run-node:
	go run ./cmd/node

run-cli:
	go run ./cmd/cli
