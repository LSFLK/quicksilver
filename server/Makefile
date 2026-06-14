.PHONY: build run test test-race lint tidy vet fmt clean docker

BINARY := bin/quicksilver-server
PKG    := ./...
VERSION ?= $(shell git describe --tags --always --dirty 2>/dev/null || echo dev)
LDFLAGS := -s -w -X main.version=$(VERSION)

build:
	@mkdir -p bin
	go build -ldflags "$(LDFLAGS)" -o $(BINARY) ./cmd/server

run:
	go run ./cmd/server

test:
	go test $(PKG)

test-race:
	go test -race -count=1 $(PKG)

vet:
	go vet $(PKG)

fmt:
	gofmt -s -w .

lint: vet
	@command -v golangci-lint >/dev/null && golangci-lint run || echo "(golangci-lint not installed; skipping)"

tidy:
	go mod tidy

clean:
	rm -rf bin

docker:
	docker build -t quicksilver-server:$(VERSION) .
