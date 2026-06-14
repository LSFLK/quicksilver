package log

import (
	"bytes"
	"context"
	"strings"
	"testing"
)

func TestRedactsSensitiveKeys(t *testing.T) {
	var buf bytes.Buffer
	logger := New("debug", "json", &buf)

	logger.Info("login",
		"email", "u@x",
		"password", "hunter2",
		"imap_password", "alsosecret",
		"Authorization", "Bearer abc.def.ghi",
	)

	s := buf.String()
	for _, leak := range []string{"hunter2", "alsosecret", "Bearer abc.def.ghi"} {
		if strings.Contains(s, leak) {
			t.Errorf("expected %q to be redacted, log was: %s", leak, s)
		}
	}
	if !strings.Contains(s, `"password":"[redacted]"`) {
		t.Errorf("expected redacted marker for password, log was: %s", s)
	}
}

func TestRequestIDContext(t *testing.T) {
	ctx := WithRequestID(context.Background(), "req-xyz")
	if got := RequestID(ctx); got != "req-xyz" {
		t.Errorf("RequestID: got %q want req-xyz", got)
	}
	if got := RequestID(context.Background()); got != "" {
		t.Errorf("missing id should be empty, got %q", got)
	}
}
