# syntax=docker/dockerfile:1.7

# --- Build stage ---
FROM golang:1.23-alpine AS build
WORKDIR /src

# Cache module downloads.
COPY go.mod go.sum ./
RUN go mod download

COPY . .

ARG VERSION=dev
RUN CGO_ENABLED=0 GOOS=linux go build \
    -ldflags "-s -w -X main.version=${VERSION}" \
    -trimpath \
    -o /out/quicksilver-server ./cmd/server

# --- Runtime stage ---
FROM gcr.io/distroless/static-debian12:nonroot
WORKDIR /
COPY --from=build /out/quicksilver-server /quicksilver-server
USER nonroot:nonroot
EXPOSE 8080
ENTRYPOINT ["/quicksilver-server"]
