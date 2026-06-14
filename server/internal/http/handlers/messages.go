package handlers

import (
	"encoding/json"
	"errors"
	"log/slog"
	"net/http"
	"net/url"
	"strconv"

	"github.com/go-chi/chi/v5"

	"quicksilver/server/internal/http/middleware"
	"quicksilver/server/internal/httpx"
	himap "quicksilver/server/internal/imap"
	"quicksilver/server/internal/mail"
	"quicksilver/server/internal/session"
	"quicksilver/server/internal/smtp"
)

// Messages serves single-message read/write endpoints.
type Messages struct {
	Sessions *session.Store
	Sealer   *session.Sealer
	Sender   *smtp.Sender
	Logger   *slog.Logger
}

// Get returns the full message at the given UID.
func (h *Messages) Get(w http.ResponseWriter, r *http.Request) {
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
	uid, err := strconv.ParseUint(chi.URLParam(r, "uid"), 10, 32)
	if err != nil {
		httpx.WriteError(w, r, h.Logger, httpx.NewAPIError(http.StatusBadRequest, httpx.CodeBadRequest, "invalid uid", err))
		return
	}
	c, err := h.Sessions.IMAPFor(r.Context(), sess)
	if err != nil {
		httpx.WriteError(w, r, h.Logger, httpx.NewAPIError(http.StatusBadGateway, httpx.CodeUpstreamFailed, "imap connect", err))
		return
	}
	msg, err := c.GetMessage(r.Context(), mailbox, uint32(uid))
	if err != nil {
		if errors.Is(err, himap.ErrNotFound) {
			httpx.WriteError(w, r, h.Logger, httpx.NewAPIError(http.StatusNotFound, httpx.CodeNotFound, "message not found", nil))
			return
		}
		httpx.WriteError(w, r, h.Logger, httpx.NewAPIError(http.StatusBadGateway, httpx.CodeUpstreamFailed, "fetch message", err))
		return
	}
	httpx.WriteJSON(w, http.StatusOK, msg)
}

type flagsRequest struct {
	Flags []string `json:"flags"`
	Add   bool     `json:"add"`
}

// SetFlags toggles flags on a message.
func (h *Messages) SetFlags(w http.ResponseWriter, r *http.Request) {
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
	uid, err := strconv.ParseUint(chi.URLParam(r, "uid"), 10, 32)
	if err != nil {
		httpx.WriteError(w, r, h.Logger, httpx.NewAPIError(http.StatusBadRequest, httpx.CodeBadRequest, "invalid uid", err))
		return
	}
	var req flagsRequest
	if err := json.NewDecoder(http.MaxBytesReader(w, r.Body, 8*1024)).Decode(&req); err != nil {
		httpx.WriteError(w, r, h.Logger, httpx.NewAPIError(http.StatusBadRequest, httpx.CodeBadRequest, "invalid json", err))
		return
	}
	if len(req.Flags) == 0 {
		httpx.WriteError(w, r, h.Logger, httpx.NewAPIError(http.StatusBadRequest, httpx.CodeBadRequest, "flags required", nil))
		return
	}
	c, err := h.Sessions.IMAPFor(r.Context(), sess)
	if err != nil {
		httpx.WriteError(w, r, h.Logger, httpx.NewAPIError(http.StatusBadGateway, httpx.CodeUpstreamFailed, "imap connect", err))
		return
	}
	if err := c.SetFlags(r.Context(), mailbox, uint32(uid), req.Flags, req.Add); err != nil {
		httpx.WriteError(w, r, h.Logger, httpx.NewAPIError(http.StatusBadGateway, httpx.CodeUpstreamFailed, "set flags", err))
		return
	}
	httpx.WriteJSON(w, http.StatusOK, map[string]string{"status": "ok"})
}

type deleteRequest struct {
	Trash string `json:"trash"`
}

// Delete moves the message to the Trash mailbox.
//
// The destination defaults to "Trash"; clients may override via body to support
// providers using a localised or non-standard trash folder name.
func (h *Messages) Delete(w http.ResponseWriter, r *http.Request) {
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
	uid, err := strconv.ParseUint(chi.URLParam(r, "uid"), 10, 32)
	if err != nil {
		httpx.WriteError(w, r, h.Logger, httpx.NewAPIError(http.StatusBadRequest, httpx.CodeBadRequest, "invalid uid", err))
		return
	}
	dest := "Trash"
	if r.ContentLength > 0 {
		var req deleteRequest
		if err := json.NewDecoder(http.MaxBytesReader(w, r.Body, 4*1024)).Decode(&req); err == nil && req.Trash != "" {
			dest = req.Trash
		}
	}
	c, err := h.Sessions.IMAPFor(r.Context(), sess)
	if err != nil {
		httpx.WriteError(w, r, h.Logger, httpx.NewAPIError(http.StatusBadGateway, httpx.CodeUpstreamFailed, "imap connect", err))
		return
	}
	if err := c.Move(r.Context(), mailbox, uint32(uid), dest); err != nil {
		httpx.WriteError(w, r, h.Logger, httpx.NewAPIError(http.StatusBadGateway, httpx.CodeUpstreamFailed, "move to trash", err))
		return
	}
	httpx.WriteJSON(w, http.StatusOK, map[string]string{"status": "ok"})
}

type sendRequest struct {
	To         []mail.Address `json:"to"`
	Cc         []mail.Address `json:"cc,omitempty"`
	Bcc        []mail.Address `json:"bcc,omitempty"`
	Subject    string         `json:"subject"`
	BodyText   string         `json:"body_text,omitempty"`
	BodyHTML   string         `json:"body_html,omitempty"`
	InReplyTo  string         `json:"in_reply_to,omitempty"`
	References []string       `json:"references,omitempty"`
	// Attachments are out-of-band: clients POST a multipart upload separately
	// or this endpoint can be switched to multipart/form-data later.
}

// Send delivers a message via SMTP using the session's stored credentials.
func (h *Messages) Send(w http.ResponseWriter, r *http.Request) {
	sess, ok := middleware.SessionFrom(r.Context())
	if !ok {
		httpx.WriteError(w, r, h.Logger, httpx.NewAPIError(http.StatusUnauthorized, httpx.CodeUnauthorized, "no session", nil))
		return
	}
	var req sendRequest
	if err := json.NewDecoder(http.MaxBytesReader(w, r.Body, 2*1024*1024)).Decode(&req); err != nil {
		httpx.WriteError(w, r, h.Logger, httpx.NewAPIError(http.StatusBadRequest, httpx.CodeBadRequest, "invalid json", err))
		return
	}
	if len(req.To) == 0 || req.Subject == "" || (req.BodyText == "" && req.BodyHTML == "") {
		httpx.WriteError(w, r, h.Logger, httpx.NewAPIError(http.StatusBadRequest, httpx.CodeBadRequest, "to, subject, and a body are required", nil))
		return
	}
	creds, err := sess.Credentials(h.Sealer)
	if err != nil {
		httpx.WriteError(w, r, h.Logger, httpx.NewAPIError(http.StatusInternalServerError, httpx.CodeInternal, "unseal credentials", err))
		return
	}
	outgoing := mail.OutgoingMessage{
		From:       mail.Address{Email: creds.Email},
		To:         req.To,
		Cc:         req.Cc,
		Bcc:        req.Bcc,
		Subject:    req.Subject,
		BodyText:   req.BodyText,
		BodyHTML:   req.BodyHTML,
		InReplyTo:  req.InReplyTo,
		References: req.References,
	}
	if err := h.Sender.Send(r.Context(), creds, outgoing); err != nil {
		httpx.WriteError(w, r, h.Logger, httpx.NewAPIError(http.StatusBadGateway, httpx.CodeUpstreamFailed, "smtp send", err))
		return
	}
	httpx.WriteJSON(w, http.StatusOK, map[string]string{"status": "sent"})
}
