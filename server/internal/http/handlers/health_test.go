package handlers

import (
	"errors"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
)

func TestLiveness(t *testing.T) {
	h := &Health{Version: "1.2.3"}
	rec := httptest.NewRecorder()
	h.Liveness(rec, httptest.NewRequest(http.MethodGet, "/healthz", nil))

	if rec.Code != http.StatusOK {
		t.Fatalf("status: got %d want 200", rec.Code)
	}
	if !strings.Contains(rec.Body.String(), `"version":"1.2.3"`) {
		t.Errorf("body missing version: %s", rec.Body.String())
	}
}

func TestReadinessOK(t *testing.T) {
	h := &Health{Ready: func() error { return nil }}
	rec := httptest.NewRecorder()
	h.Readiness(rec, httptest.NewRequest(http.MethodGet, "/readyz", nil))

	if rec.Code != http.StatusOK {
		t.Fatalf("status: got %d want 200", rec.Code)
	}
}

func TestReadinessNotReady(t *testing.T) {
	h := &Health{Ready: func() error { return errors.New("upstream down") }}
	rec := httptest.NewRecorder()
	h.Readiness(rec, httptest.NewRequest(http.MethodGet, "/readyz", nil))

	if rec.Code != http.StatusServiceUnavailable {
		t.Fatalf("status: got %d want 503", rec.Code)
	}
	if !strings.Contains(rec.Body.String(), "upstream down") {
		t.Errorf("expected reason in body, got %s", rec.Body.String())
	}
}
