package handlers

import (
	"log/slog"
	"net/http"
	"net/url"
	"strconv"
	"strings"

	"github.com/go-chi/chi/v5"

	"quicksilver/server/internal/http/middleware"
	"quicksilver/server/internal/httpx"
	"quicksilver/server/internal/session"
)

// Mailboxes serves mailbox listing and message-envelope endpoints.
type Mailboxes struct {
	Sessions *session.Store
	Logger   *slog.Logger
}

// List returns the user's mailboxes.
func (h *Mailboxes) List(w http.ResponseWriter, r *http.Request) {
	sess, ok := middleware.SessionFrom(r.Context())
	if !ok {
		httpx.WriteError(w, r, h.Logger, httpx.NewAPIError(http.StatusUnauthorized, httpx.CodeUnauthorized, "no session", nil))
		return
	}
	c, err := h.Sessions.IMAPFor(r.Context(), sess)
	if err != nil {
		httpx.WriteError(w, r, h.Logger, httpx.NewAPIError(http.StatusBadGateway, httpx.CodeUpstreamFailed, "imap connect", err))
		return
	}
	mboxes, err := c.ListMailboxes(r.Context())
	if err != nil {
		httpx.WriteError(w, r, h.Logger, httpx.NewAPIError(http.StatusBadGateway, httpx.CodeUpstreamFailed, "list mailboxes", err))
		return
	}
	httpx.WriteJSON(w, http.StatusOK, map[string]any{"mailboxes": mboxes})
}

// ListMessages returns paginated envelopes for the named mailbox.
//
// Query params:
//   - limit (1..200, default 50)
//   - before (cursor: UID — returns messages with UID < before)
func (h *Mailboxes) ListMessages(w http.ResponseWriter, r *http.Request) {
	sess, ok := middleware.SessionFrom(r.Context())
	if !ok {
		httpx.WriteError(w, r, h.Logger, httpx.NewAPIError(http.StatusUnauthorized, httpx.CodeUnauthorized, "no session", nil))
		return
	}
	mailbox, err := url.PathUnescape(chi.URLParam(r, "mailbox"))
	if err != nil || mailbox == "" {
		httpx.WriteError(w, r, h.Logger, httpx.NewAPIError(http.StatusBadRequest, httpx.CodeBadRequest, "invalid mailbox name", err))
		return
	}
	limit, _ := strconv.Atoi(r.URL.Query().Get("limit"))
	before, _ := strconv.ParseUint(r.URL.Query().Get("before"), 10, 32)

	c, err := h.Sessions.IMAPFor(r.Context(), sess)
	if err != nil {
		httpx.WriteError(w, r, h.Logger, httpx.NewAPIError(http.StatusBadGateway, httpx.CodeUpstreamFailed, "imap connect", err))
		return
	}
	envelopes, total, uidvalidity, err := c.ListMessages(r.Context(), mailbox, limit, uint32(before))
	if err != nil {
		httpx.WriteError(w, r, h.Logger, httpx.NewAPIError(http.StatusBadGateway, httpx.CodeUpstreamFailed, "list messages", err))
		return
	}
	resp := map[string]any{"messages": envelopes, "total": total, "uidvalidity": uidvalidity}
	if len(envelopes) > 0 {
		resp["next_before"] = envelopes[len(envelopes)-1].UID
	}
	httpx.WriteJSON(w, http.StatusOK, resp)
}

// Changes returns an incremental-sync delta for the named mailbox (proposal §6),
// so the client refreshes by fetching only what changed rather than re-listing.
//
// Query params:
//   - uidvalidity (the client's cached UIDVALIDITY; 0/absent on first sync)
//   - known       (comma-separated UIDs the client currently holds)
//   - limit       (1..200, default 50 — caps how many new envelopes are returned)
func (h *Mailboxes) Changes(w http.ResponseWriter, r *http.Request) {
	sess, ok := middleware.SessionFrom(r.Context())
	if !ok {
		httpx.WriteError(w, r, h.Logger, httpx.NewAPIError(http.StatusUnauthorized, httpx.CodeUnauthorized, "no session", nil))
		return
	}
	mailbox, err := url.PathUnescape(chi.URLParam(r, "mailbox"))
	if err != nil || mailbox == "" {
		httpx.WriteError(w, r, h.Logger, httpx.NewAPIError(http.StatusBadRequest, httpx.CodeBadRequest, "invalid mailbox name", err))
		return
	}
	q := r.URL.Query()
	uidvalidity, _ := strconv.ParseUint(q.Get("uidvalidity"), 10, 32)
	limit, _ := strconv.Atoi(q.Get("limit"))
	known := parseUIDList(q.Get("known"))

	c, err := h.Sessions.IMAPFor(r.Context(), sess)
	if err != nil {
		httpx.WriteError(w, r, h.Logger, httpx.NewAPIError(http.StatusBadGateway, httpx.CodeUpstreamFailed, "imap connect", err))
		return
	}
	delta, err := c.MailboxChanges(r.Context(), mailbox, uint32(uidvalidity), known, limit)
	if err != nil {
		httpx.WriteError(w, r, h.Logger, httpx.NewAPIError(http.StatusBadGateway, httpx.CodeUpstreamFailed, "mailbox changes", err))
		return
	}
	httpx.WriteJSON(w, http.StatusOK, delta)
}

// parseUIDList parses a comma-separated list of UIDs, skipping any malformed or
// zero entries. Caps the input to a sane bound so a runaway query string can't
// force an unbounded FETCH.
func parseUIDList(s string) []uint32 {
	if s == "" {
		return nil
	}
	parts := strings.Split(s, ",")
	if len(parts) > 1000 {
		parts = parts[:1000]
	}
	out := make([]uint32, 0, len(parts))
	for _, p := range parts {
		n, err := strconv.ParseUint(strings.TrimSpace(p), 10, 32)
		if err != nil || n == 0 {
			continue
		}
		out = append(out, uint32(n))
	}
	return out
}
