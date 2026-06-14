package middleware

import (
	"context"
	"net/http"
	"strings"

	"quicksilver/server/internal/auth"
	"quicksilver/server/internal/httpx"
	"quicksilver/server/internal/session"
)

type ctxKey int

const sessionCtxKey ctxKey = 1

// SessionFrom returns the session attached to ctx by RequireSession.
func SessionFrom(ctx context.Context) (*session.Session, bool) {
	s, ok := ctx.Value(sessionCtxKey).(*session.Session)
	return s, ok
}

// RequireSession verifies the bearer token and attaches the resolved session
// to the request context. Returns 401 on any auth failure.
func RequireSession(issuer *auth.Issuer, store *session.Store) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			tok := bearerToken(r)
			if tok == "" {
				httpx.WriteError(w, r, nil, httpx.NewAPIError(http.StatusUnauthorized, httpx.CodeUnauthorized, "missing bearer token", nil))
				return
			}
			claims, err := issuer.Verify(tok)
			if err != nil {
				httpx.WriteError(w, r, nil, httpx.NewAPIError(http.StatusUnauthorized, httpx.CodeUnauthorized, "invalid token", err))
				return
			}
			sess, ok := store.Get(claims.SessionID)
			if !ok {
				httpx.WriteError(w, r, nil, httpx.NewAPIError(http.StatusUnauthorized, httpx.CodeUnauthorized, "session expired", nil))
				return
			}
			ctx := context.WithValue(r.Context(), sessionCtxKey, sess)
			next.ServeHTTP(w, r.WithContext(ctx))
		})
	}
}

func bearerToken(r *http.Request) string {
	h := r.Header.Get("Authorization")
	const prefix = "Bearer "
	if !strings.HasPrefix(h, prefix) {
		return ""
	}
	return strings.TrimSpace(h[len(prefix):])
}
