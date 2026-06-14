// Package httpx contains transport-layer helpers (error envelope, JSON writer)
// shared by the router and individual handlers without creating an import cycle.
package httpx

import (
	"encoding/json"
	"errors"
	"log/slog"
	"net/http"
)

// ErrorCode identifies a class of API error so clients can branch on it.
type ErrorCode string

const (
	CodeBadRequest     ErrorCode = "bad_request"
	CodeUnauthorized   ErrorCode = "unauthorized"
	CodeForbidden      ErrorCode = "forbidden"
	CodeNotFound       ErrorCode = "not_found"
	CodeConflict       ErrorCode = "conflict"
	CodeRateLimited    ErrorCode = "rate_limited"
	CodeUpstreamFailed ErrorCode = "upstream_failed"
	CodeInternal       ErrorCode = "internal"
)

// APIError is the wire-format error envelope. Internal details never appear in
// Message; they go to the structured log via Err.
type APIError struct {
	Status  int       `json:"-"`
	Code    ErrorCode `json:"code"`
	Message string    `json:"error"`
	Err     error     `json:"-"`
}

// Error implements the error interface.
func (e *APIError) Error() string {
	if e.Err != nil {
		return e.Message + ": " + e.Err.Error()
	}
	return e.Message
}

// Unwrap allows errors.Is / errors.As to reach the wrapped cause.
func (e *APIError) Unwrap() error { return e.Err }

// NewAPIError constructs an APIError.
func NewAPIError(status int, code ErrorCode, msg string, cause error) *APIError {
	return &APIError{Status: status, Code: code, Message: msg, Err: cause}
}

// WriteError serializes err to w. Non-APIError values are reported as
// CodeInternal so internal details never leak to clients.
func WriteError(w http.ResponseWriter, r *http.Request, logger *slog.Logger, err error) {
	var apiErr *APIError
	if !errors.As(err, &apiErr) {
		apiErr = &APIError{
			Status:  http.StatusInternalServerError,
			Code:    CodeInternal,
			Message: "internal server error",
			Err:     err,
		}
	}
	if apiErr.Status >= 500 && logger != nil {
		logger.LogAttrs(r.Context(), slog.LevelError, "request failed",
			slog.String("path", r.URL.Path),
			slog.String("method", r.Method),
			slog.String("code", string(apiErr.Code)),
			slog.Any("err", apiErr.Err),
		)
	}
	WriteJSON(w, apiErr.Status, apiErr)
}

// WriteJSON serializes v as application/json with the given status.
func WriteJSON(w http.ResponseWriter, status int, v any) {
	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(v)
}
