package handlers

import (
	"context"
	"encoding/json"
	"fmt"
	"log/slog"
	"net/http"
	"strings"
	"time"

	"quicksilver/server/internal/http/middleware"
	"quicksilver/server/internal/httpx"
	"quicksilver/server/internal/imap"
	"quicksilver/server/internal/realtime"
	"quicksilver/server/internal/session"
)

// Events serves the realtime change-notification stream over Server-Sent Events
// (proposal §6, Phase 4). The browser opens one EventSource; the gateway holds
// an IMAP IDLE connection per watched mailbox and pushes a tiny "changed" event
// whenever that mailbox changes, prompting the client to run a delta sync.
type Events struct {
	Sessions  *session.Store
	Hub       *realtime.Hub
	Logger    *slog.Logger
	Heartbeat time.Duration // comment-ping interval to keep the stream alive
}

// Stream is GET /api/v1/events. Auth is via the standard bearer token, which
// RequireSession also accepts as an access_token query param because the
// browser EventSource API cannot set request headers.
//
// Query params:
//   - mailbox: comma-separated mailbox names to watch (default INBOX)
func (h *Events) Stream(w http.ResponseWriter, r *http.Request) {
	sess, ok := middleware.SessionFrom(r.Context())
	if !ok {
		httpx.WriteError(w, r, h.Logger, httpx.NewAPIError(http.StatusUnauthorized, httpx.CodeUnauthorized, "no session", nil))
		return
	}

	mailboxes := parseMailboxes(r.URL.Query().Get("mailbox"))
	if len(mailboxes) == 0 {
		mailboxes = []string{"INBOX"}
	}

	rc := http.NewResponseController(w)
	// SSE streams stay open far longer than the server's WriteTimeout; clear the
	// per-connection write deadline so it isn't killed mid-stream.
	if err := rc.SetWriteDeadline(time.Time{}); err != nil {
		h.Logger.Warn("events: clear write deadline", "err", err)
	}

	h2 := w.Header()
	h2.Set("Content-Type", "text/event-stream")
	h2.Set("Cache-Control", "no-cache")
	h2.Set("Connection", "keep-alive")
	h2.Set("X-Accel-Buffering", "no") // disable proxy buffering (nginx)
	w.WriteHeader(http.StatusOK)

	dial := func(ctx context.Context) (*imap.Client, error) {
		return h.Sessions.DialIMAP(ctx, sess)
	}
	sub, cleanup := h.Hub.Subscribe(sess.ID, dial, mailboxes)
	defer cleanup()

	// Open the stream with a comment so the browser fires `onopen` promptly.
	if _, err := fmt.Fprint(w, ": connected\n\n"); err != nil {
		return
	}
	_ = rc.Flush()

	heartbeat := h.Heartbeat
	if heartbeat <= 0 {
		heartbeat = 25 * time.Second
	}
	hb := time.NewTicker(heartbeat)
	defer hb.Stop()

	ctx := r.Context()
	for {
		select {
		case <-ctx.Done():
			return
		case ev := <-sub.C:
			b, err := json.Marshal(ev)
			if err != nil {
				continue
			}
			if _, err := fmt.Fprintf(w, "event: changed\ndata: %s\n\n", b); err != nil {
				return
			}
			if err := rc.Flush(); err != nil {
				return
			}
		case <-hb.C:
			// Keep the session warm while the user is actively connected, and
			// keep idle proxies from closing the stream.
			sess.Touch()
			if _, err := fmt.Fprint(w, ": ping\n\n"); err != nil {
				return
			}
			if err := rc.Flush(); err != nil {
				return
			}
		}
	}
}

// parseMailboxes splits a comma-separated mailbox list, trimming blanks and
// capping the count so one connection can't spin up an unbounded number of IDLE
// connections.
func parseMailboxes(s string) []string {
	if s == "" {
		return nil
	}
	parts := strings.Split(s, ",")
	out := make([]string, 0, len(parts))
	for _, p := range parts {
		p = strings.TrimSpace(p)
		if p == "" {
			continue
		}
		out = append(out, p)
		if len(out) >= 8 {
			break
		}
	}
	return out
}
