package handlers

import (
	"log/slog"
	"net/http"
	"net/url"
	"strconv"

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
	envelopes, err := c.ListMessages(r.Context(), mailbox, limit, uint32(before))
	if err != nil {
		httpx.WriteError(w, r, h.Logger, httpx.NewAPIError(http.StatusBadGateway, httpx.CodeUpstreamFailed, "list messages", err))
		return
	}
	resp := map[string]any{"messages": envelopes}
	if len(envelopes) > 0 {
		resp["next_before"] = envelopes[len(envelopes)-1].UID
	}
	httpx.WriteJSON(w, http.StatusOK, resp)
}
