.PHONY: build clean run cluster-up cluster-down test

build:
	go build -o bin/node ./cmd/node
	go build -o bin/krato-cli ./cmd/cli

clean:
	rm -rf bin/
	rm -f *.db *.wal

test:
	go test -v ./...

cluster-up:
	docker compose up -d --build

cluster-down:
	docker compose down -v

verify:
	sh scripts/verify_cluster.sh
