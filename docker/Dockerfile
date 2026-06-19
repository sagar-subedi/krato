# --- STAGE 1: Frontend Build ---
FROM node:20 AS web-builder
WORKDIR /app
# Copy manifest files first for caching
COPY web/package.json web/package-lock.json ./
RUN npm ci
# Copy everything from web/ to current dir
COPY web .
# Debug: Where are the files?
RUN ls -R
RUN npx tsc -b
RUN npx vite build --debug

# --- STAGE 2: Backend Build ---
FROM  golang:1.25-alpine AS go-builder
WORKDIR /app
# Install build dependencies
RUN apk add --no-cache git
COPY go.mod go.sum ./
RUN go mod download
COPY . .
# Build static binary
RUN CGO_ENABLED=0 GOOS=linux go build -o krato-node ./cmd/node/main.go

# --- STAGE 3: Final Production Image ---
FROM alpine:latest
RUN apk add --no-cache ca-certificates tzdata

WORKDIR /app
# Copy binary from go-builder
COPY --from=go-builder /app/krato-node /app/node
# Copy assets from web-builder
COPY --from=web-builder /app/dist /app/web/dist

# Default ports
EXPOSE 8080 9090 7070

# Persistance volume
VOLUME ["/data"]

# Run the node
ENTRYPOINT ["/app/node"]
