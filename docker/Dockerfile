# --- STAGE 1: Frontend Build ---
FROM node:20-alpine AS web-builder
WORKDIR /app/web
# Copy package files
COPY web/package*.json ./
# Use install instead of ci to resolve discrepancies during debugging
RUN npm install
# Copy source
COPY web/ ./
# Verify structure (Debug)
RUN ls -la index.html
# Build
RUN npm run build

# --- STAGE 2: Backend Build ---
FROM golang:1.25-alpine AS go-builder
WORKDIR /app
RUN apk add --no-cache git
COPY go.mod go.sum ./
RUN go mod download
COPY . .
RUN CGO_ENABLED=0 GOOS=linux go build -o krato-node ./cmd/node/main.go

# --- STAGE 3: Final Production Image ---
FROM alpine:latest
RUN apk add --no-cache ca-certificates tzdata
WORKDIR /app
COPY --from=go-builder /app/krato-node /app/node
COPY --from=web-builder /app/web/dist /app/web/dist

# Default ports
EXPOSE 18080 19090 17070

# Persistence volume
VOLUME ["/data"]

ENTRYPOINT ["/app/node"]
