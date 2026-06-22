package handlers

import (
	"crypto/rand"
	"crypto/subtle"
	"encoding/hex"
	"log/slog"
	"net/http"
	"net/url"

	"quicksilver/server/internal/auth"
	"quicksilver/server/internal/mail"
	"quicksilver/server/internal/oauth"
	"quicksilver/server/internal/session"
)

// Gmail's well-known IMAP/SMTP endpoints. OAuth login is Google-only, so these
// are fixed rather than user-supplied.
const (
	gmailIMAPHost = "imap.gmail.com"
	gmailIMAPPort = 993
	gmailSMTPHost = "smtp.gmail.com"
	gmailSMTPPort = 587
)

const oauthStateCookie = "qs_oauth_state"

// OAuth bundles dependencies for the Google OAuth login flow.
type OAuth struct {
	Provider         *oauth.Provider
	Sessions         *session.Store
	Issuer           *auth.Issuer
	FrontendCallback string // SPA URL that receives the JWT in its fragment
	Logger           *slog.Logger
}

// Start begins the Google OAuth flow: it sets an anti-CSRF state cookie and
// redirects the browser to Google's consent screen.
func (o *OAuth) Start(w http.ResponseWriter, r *http.Request) {
	if !o.Provider.Enabled() {
		http.NotFound(w, r)
		return
	}
	state, err := randomState()
	if err != nil {
		http.Error(w, "internal error", http.StatusInternalServerError)
		return
	}
	http.SetCookie(w, &http.Cookie{
		Name:     oauthStateCookie,
		Value:    state,
		Path:     "/",
		MaxAge:   600,
		HttpOnly: true,
		SameSite: http.SameSiteLaxMode,
		Secure:   r.TLS != nil,
	})
	http.Redirect(w, r, o.Provider.AuthCodeURL(state), http.StatusFound)
}

// Callback completes the flow: it validates state, exchanges the code for
// tokens, resolves the user's email, opens an XOAUTH2 IMAP session, and
// redirects back to the SPA with a Quicksilver JWT in the URL fragment.
func (o *OAuth) Callback(w http.ResponseWriter, r *http.Request) {
	if !o.Provider.Enabled() {
		http.NotFound(w, r)
		return
	}

	// Anti-CSRF: the state in the query must match the cookie we set in Start.
	cookie, err := r.Cookie(oauthStateCookie)
	qState := r.URL.Query().Get("state")
	if err != nil || qState == "" ||
		subtle.ConstantTimeCompare([]byte(cookie.Value), []byte(qState)) != 1 {
		o.fail(w, r, "invalid_state")
		return
	}
	// Clear the state cookie now that it's been used.
	http.SetCookie(w, &http.Cookie{Name: oauthStateCookie, Path: "/", MaxAge: -1})

	if errParam := r.URL.Query().Get("error"); errParam != "" {
		o.fail(w, r, errParam)
		return
	}
	code := r.URL.Query().Get("code")
	if code == "" {
		o.fail(w, r, "missing_code")
		return
	}

	ctx := r.Context()
	tok, err := o.Provider.Exchange(ctx, code)
	if err != nil {
		o.Logger.Warn("oauth exchange failed", "err", err)
		o.fail(w, r, "exchange_failed")
		return
	}
	email, err := o.Provider.Email(ctx, tok)
	if err != nil {
		o.Logger.Warn("oauth userinfo failed", "err", err)
		o.fail(w, r, "userinfo_failed")
		return
	}

	creds := mail.Credentials{
		Email:        email,
		IMAPHost:     gmailIMAPHost,
		IMAPPort:     gmailIMAPPort,
		IMAPSecure:   true,
		SMTPHost:     gmailSMTPHost,
		SMTPPort:     gmailSMTPPort,
		SMTPSecure:   false, // STARTTLS on 587
		AuthType:     mail.AuthOAuth2,
		AccessToken:  tok.AccessToken,
		RefreshToken: tok.RefreshToken,
		TokenExpiry:  tok.Expiry,
	}
	sess, err := o.Sessions.Create(ctx, creds)
	if err != nil {
		o.Logger.Warn("oauth session create failed", "err", err, "email", email)
		o.fail(w, r, "imap_login_failed")
		return
	}
	token, _, err := o.Issuer.Issue(sess.ID, sess.Subject)
	if err != nil {
		o.Sessions.Delete(sess.ID)
		o.fail(w, r, "issue_token_failed")
		return
	}

	// Hand the JWT to the SPA via the URL fragment (never sent to a server, not
	// logged in proxies/referers). The SPA reads it and stores the session.
	frag := url.Values{}
	frag.Set("token", token)
	frag.Set("email", sess.Subject)
	http.Redirect(w, r, o.FrontendCallback+"#"+frag.Encode(), http.StatusFound)
}

// fail redirects back to the SPA callback with an error code in the fragment.
func (o *OAuth) fail(w http.ResponseWriter, r *http.Request, reason string) {
	frag := url.Values{}
	frag.Set("error", reason)
	http.Redirect(w, r, o.FrontendCallback+"#"+frag.Encode(), http.StatusFound)
}

func randomState() (string, error) {
	var b [32]byte
	if _, err := rand.Read(b[:]); err != nil {
		return "", err
	}
	return hex.EncodeToString(b[:]), nil
}
