// Package handlers contains HTTP handlers for the Quicksilver API.
package handlers

import (
	"net/http"

	"quicksilver/server/internal/httpx"
)

// Health implements liveness and readiness probes.
type Health struct {
	Version string
	Ready   func() error
}

// Liveness reports the process is up. Always 200 if the server can respond.
func (h *Health) Liveness(w http.ResponseWriter, _ *http.Request) {
	httpx.WriteJSON(w, http.StatusOK, map[string]string{
		"status":  "ok",
		"version": h.Version,
	})
}

// Readiness reports whether the server is ready to accept traffic. Returns 503
// if the supplied Ready function returns an error.
func (h *Health) Readiness(w http.ResponseWriter, _ *http.Request) {
	if h.Ready != nil {
		if err := h.Ready(); err != nil {
			httpx.WriteJSON(w, http.StatusServiceUnavailable, map[string]string{
				"status": "not_ready",
				"reason": err.Error(),
			})
			return
		}
	}
	httpx.WriteJSON(w, http.StatusOK, map[string]string{"status": "ready"})
}
