# --- STAGE 1: Frontend Build ---
FROM node:22-alpine AS web-builder
WORKDIR /app/web
# Copy manifest files first for caching
COPY web/package*.json ./
# Clean install to ensure no version conflicts
RUN npm install
# Copy the rest of the web folder
COPY web/ .
# Build the application
RUN npm run build

# --- STAGE 2: Backend Build ---
FROM golang:1.25-alpine AS go-builder
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
COPY --from=web-builder /app/web/dist /app/web/dist

# Custom Port range (18XXX block)
EXPOSE 18080 19090 17070

# Persistence volume
VOLUME ["/data"]

# Run the node
ENTRYPOINT ["/app/node"]
