package handlers

import (
	"encoding/json"
	"log/slog"
	"net/http"
	"time"

	"quicksilver/server/internal/auth"
	"quicksilver/server/internal/http/middleware"
	"quicksilver/server/internal/httpx"
	"quicksilver/server/internal/mail"
	"quicksilver/server/internal/session"
)

// Auth bundles dependencies for the /auth/* handlers.
type Auth struct {
	Sessions *session.Store
	Issuer   *auth.Issuer
	Logger   *slog.Logger
}

type loginRequest struct {
	Email      string `json:"email"`
	Password   string `json:"password"`
	IMAPHost   string `json:"imap_host"`
	IMAPPort   int    `json:"imap_port"`
	IMAPSecure bool   `json:"imap_secure"`
	SMTPHost   string `json:"smtp_host"`
	SMTPPort   int    `json:"smtp_port"`
	SMTPSecure bool   `json:"smtp_secure"`
}

type loginResponse struct {
	Token     string    `json:"token"`
	ExpiresAt time.Time `json:"expires_at"`
	Subject   string    `json:"subject"`
	SessionID string    `json:"session_id"`
}

// Login validates IMAP/SMTP credentials, creates a session, returns a JWT.
func (a *Auth) Login(w http.ResponseWriter, r *http.Request) {
	var req loginRequest
	if err := json.NewDecoder(http.MaxBytesReader(w, r.Body, 64*1024)).Decode(&req); err != nil {
		httpx.WriteError(w, r, a.Logger, httpx.NewAPIError(http.StatusBadRequest, httpx.CodeBadRequest, "invalid json body", err))
		return
	}
	creds := mail.Credentials{
		Email:      req.Email,
		Password:   req.Password,
		IMAPHost:   req.IMAPHost,
		IMAPPort:   req.IMAPPort,
		IMAPSecure: req.IMAPSecure,
		SMTPHost:   req.SMTPHost,
		SMTPPort:   req.SMTPPort,
		SMTPSecure: req.SMTPSecure,
	}
	sess, err := a.Sessions.Create(r.Context(), creds)
	if err != nil {
		// Treat any login failure as 401 to avoid leaking provider state.
		httpx.WriteError(w, r, a.Logger, httpx.NewAPIError(http.StatusUnauthorized, httpx.CodeUnauthorized, "login failed", err))
		return
	}
	token, exp, err := a.Issuer.Issue(sess.ID, sess.Subject)
	if err != nil {
		a.Sessions.Delete(sess.ID)
		httpx.WriteError(w, r, a.Logger, httpx.NewAPIError(http.StatusInternalServerError, httpx.CodeInternal, "issue token", err))
		return
	}
	httpx.WriteJSON(w, http.StatusOK, loginResponse{
		Token:     token,
		ExpiresAt: exp,
		Subject:   sess.Subject,
		SessionID: sess.ID,
	})
}

// Logout closes the current session.
func (a *Auth) Logout(w http.ResponseWriter, r *http.Request) {
	sess, ok := middleware.SessionFrom(r.Context())
	if !ok {
		httpx.WriteError(w, r, a.Logger, httpx.NewAPIError(http.StatusUnauthorized, httpx.CodeUnauthorized, "no session", nil))
		return
	}
	a.Sessions.Delete(sess.ID)
	httpx.WriteJSON(w, http.StatusOK, map[string]string{"status": "ok"})
}
