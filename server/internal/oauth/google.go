// Package oauth implements the server-side Google OAuth2 flow used to
// authenticate users without a password: the gateway runs the authorization
// code exchange and hands the resulting access token to IMAP/SMTP over SASL
// XOAUTH2 (see internal/imap and internal/smtp).
//
// The provider is optional. When no client ID is configured it reports
// Enabled()==false and the HTTP handlers return 404, leaving password login as
// the only path.
package oauth

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"time"

	"golang.org/x/oauth2"
	"golang.org/x/oauth2/google"
)

// Scopes requested from Google:
//   - https://mail.google.com/ grants IMAP/SMTP access (required for XOAUTH2).
//   - userinfo.email + openid let us read the signed-in address for the session.
var scopes = []string{
	"https://mail.google.com/",
	"https://www.googleapis.com/auth/userinfo.email",
	"openid",
}

const userInfoURL = "https://www.googleapis.com/oauth2/v3/userinfo"

// Provider wraps a configured Google OAuth2 client.
type Provider struct {
	cfg     *oauth2.Config
	enabled bool
}

// NewGoogle builds a provider from OAuth client credentials. If clientID is
// empty the provider is disabled (Enabled() == false) and all methods that need
// the client return an error.
func NewGoogle(clientID, clientSecret, redirectURL string) *Provider {
	if clientID == "" || clientSecret == "" || redirectURL == "" {
		return &Provider{enabled: false}
	}
	return &Provider{
		enabled: true,
		cfg: &oauth2.Config{
			ClientID:     clientID,
			ClientSecret: clientSecret,
			RedirectURL:  redirectURL,
			Scopes:       scopes,
			Endpoint:     google.Endpoint,
		},
	}
}

// Enabled reports whether Google OAuth is configured.
func (p *Provider) Enabled() bool { return p.enabled }

// AuthCodeURL returns the Google consent URL for the given anti-CSRF state.
// AccessTypeOffline + prompt=consent ensures Google returns a refresh token so
// long-lived sessions can mint fresh access tokens.
func (p *Provider) AuthCodeURL(state string) string {
	return p.cfg.AuthCodeURL(state,
		oauth2.AccessTypeOffline,
		oauth2.SetAuthURLParam("prompt", "consent"),
	)
}

// Exchange swaps an authorization code for tokens.
func (p *Provider) Exchange(ctx context.Context, code string) (*oauth2.Token, error) {
	if !p.enabled {
		return nil, errors.New("oauth not configured")
	}
	return p.cfg.Exchange(ctx, code)
}

// Email fetches the signed-in user's email address from Google's userinfo
// endpoint using the access token.
func (p *Provider) Email(ctx context.Context, tok *oauth2.Token) (string, error) {
	client := p.cfg.Client(ctx, tok)
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, userInfoURL, nil)
	if err != nil {
		return "", err
	}
	resp, err := client.Do(req)
	if err != nil {
		return "", fmt.Errorf("userinfo: %w", err)
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		return "", fmt.Errorf("userinfo: unexpected status %d", resp.StatusCode)
	}
	var body struct {
		Email         string `json:"email"`
		EmailVerified bool   `json:"email_verified"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&body); err != nil {
		return "", fmt.Errorf("decode userinfo: %w", err)
	}
	if body.Email == "" {
		return "", errors.New("userinfo returned no email")
	}
	return body.Email, nil
}

// FreshToken returns a valid access token, transparently refreshing via the
// refresh token if the current access token has expired. It reports whether the
// token actually changed so callers can re-persist it. Implements the
// session.TokenRefresher interface.
func (p *Provider) FreshToken(
	ctx context.Context,
	accessToken, refreshToken string,
	expiry time.Time,
) (newAccess, newRefresh string, newExpiry time.Time, changed bool, err error) {
	if !p.enabled {
		return "", "", time.Time{}, false, errors.New("oauth not configured")
	}
	prev := &oauth2.Token{
		AccessToken:  accessToken,
		RefreshToken: refreshToken,
		Expiry:       expiry,
	}
	// TokenSource refreshes lazily: if prev is still valid it's returned as-is;
	// otherwise the refresh token is used to obtain a new access token.
	fresh, err := p.cfg.TokenSource(ctx, prev).Token()
	if err != nil {
		return "", "", time.Time{}, false, fmt.Errorf("refresh token: %w", err)
	}
	// Google may omit the refresh token on refresh responses — keep the old one.
	rt := fresh.RefreshToken
	if rt == "" {
		rt = refreshToken
	}
	changed = fresh.AccessToken != accessToken
	return fresh.AccessToken, rt, fresh.Expiry, changed, nil
}
