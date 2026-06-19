# --- STAGE 1: Frontend Build ---
FROM node:20-alpine AS web-builder
WORKDIR /web
COPY web/package*.json ./
RUN npm install
COPY web/ ./
RUN npm run build

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
COPY --from=web-builder /web/dist /app/web/dist

# Default ports
EXPOSE 8080 9090 7070

# Persistance volume
VOLUME ["/data"]

# Run the node
ENTRYPOINT ["/app/node"]
