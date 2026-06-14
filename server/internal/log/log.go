// Package log builds the application slog.Logger with credential redaction.
package log

import (
	"context"
	"io"
	"log/slog"
	"os"
	"strings"
)

// sensitiveKeys are attribute keys whose values are always replaced with "[redacted]".
//
// Match is case-insensitive. Substring match is intentional so wrappers like
// "smtp_password" or "imap.password" are still caught.
var sensitiveKeys = []string{
	"password",
	"secret",
	"authorization",
	"token",
	"jwt",
	"cookie",
	"set-cookie",
	"api_key",
	"apikey",
}

// New constructs a slog.Logger with the configured level and format.
//
// level accepts "debug", "info", "warn", "error" (case-insensitive).
// format accepts "json" or "text".
func New(level, format string, out io.Writer) *slog.Logger {
	if out == nil {
		out = os.Stdout
	}
	opts := &slog.HandlerOptions{
		Level:       parseLevel(level),
		ReplaceAttr: redactAttr,
	}
	var h slog.Handler
	if strings.EqualFold(format, "text") {
		h = slog.NewTextHandler(out, opts)
	} else {
		h = slog.NewJSONHandler(out, opts)
	}
	return slog.New(h)
}

func parseLevel(s string) slog.Level {
	switch strings.ToLower(s) {
	case "debug":
		return slog.LevelDebug
	case "warn", "warning":
		return slog.LevelWarn
	case "error":
		return slog.LevelError
	default:
		return slog.LevelInfo
	}
}

func redactAttr(_ []string, a slog.Attr) slog.Attr {
	key := strings.ToLower(a.Key)
	for _, s := range sensitiveKeys {
		if strings.Contains(key, s) {
			return slog.String(a.Key, "[redacted]")
		}
	}
	return a
}

// requestIDKey is the context key used to thread request IDs into the logger.
type requestIDKey struct{}

// WithRequestID returns a copy of ctx carrying the given request ID.
func WithRequestID(ctx context.Context, id string) context.Context {
	return context.WithValue(ctx, requestIDKey{}, id)
}

// RequestID extracts the request ID from ctx, or "" if absent.
func RequestID(ctx context.Context) string {
	if v, ok := ctx.Value(requestIDKey{}).(string); ok {
		return v
	}
	return ""
}

// FromContext returns a logger annotated with the request ID, if any.
func FromContext(ctx context.Context, base *slog.Logger) *slog.Logger {
	if id := RequestID(ctx); id != "" {
		return base.With("request_id", id)
	}
	return base
}
