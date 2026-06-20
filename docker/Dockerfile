# --- STAGE 1: Unified Build Stage ---
FROM node:22-alpine AS build-env
WORKDIR /app

# Copy the entire repository to preserve structure
COPY . .

# Build Frontend
WORKDIR /app/web
RUN npm install --legacy-peer-deps
RUN npm run build

# --- STAGE 2: Backend Build ---
FROM golang:1.25-alpine AS go-builder
WORKDIR /app
RUN apk add --no-cache git
# Use the files already in the context
COPY . .
RUN CGO_ENABLED=0 GOOS=linux go build -o krato-node ./cmd/node/main.go

# --- STAGE 3: Final Production Image ---
FROM alpine:latest
RUN apk add --no-cache ca-certificates tzdata
WORKDIR /app
COPY --from=go-builder /app/krato-node /app/node
COPY --from=build-env /app/web/dist /app/web/dist

# Custom Port Block
EXPOSE 18080 19090 17070

VOLUME ["/data"]

ENTRYPOINT ["/app/node"]
