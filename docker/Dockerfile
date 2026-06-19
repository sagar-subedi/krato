# Use a locally available alpine-based image to bypass network issues
FROM redis:7.4.1-alpine

WORKDIR /app
# Copy the locally built binary and web assets
COPY bin/node /app/node
COPY web/dist /app/web/dist

# Expose ports
EXPOSE 8080 9090 7070

# Volume for persistence
VOLUME ["/data"]

# Override Redis entrypoint/cmd
ENTRYPOINT ["/app/node"]
