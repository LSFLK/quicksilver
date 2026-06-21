package http

import (
	"context"
	"log/slog"
	"net/http"

	"github.com/go-chi/chi/v5"

	"quicksilver/server/internal/auth"
	"quicksilver/server/internal/config"
	"quicksilver/server/internal/http/handlers"
	"quicksilver/server/internal/http/middleware"
	"quicksilver/server/internal/session"
	"quicksilver/server/internal/smtp"
)

// Deps bundles the collaborators required to build the router.
type Deps struct {
	Config   *config.Config
	Logger   *slog.Logger
	Version  string
	Ready    func() error
	Sessions *session.Store
	Issuer   *auth.Issuer
	Sealer   *session.Sealer
	Sender   *smtp.Sender
	// RateLimitCtx scopes the rate limiter's background reaper. When the
	// context is cancelled, the limiter stops reaping idle IP entries.
	RateLimitCtx context.Context
}

// NewRouter wires middleware and handlers and returns the top-level mux.
func NewRouter(d Deps) http.Handler {
	r := chi.NewRouter()

	r.Use(middleware.RequestID)
	r.Use(middleware.Recover(d.Logger))
	r.Use(middleware.SecurityHeaders)
	r.Use(middleware.CORS(d.Config.AllowedOrigins))
	r.Use(middleware.AccessLog(d.Logger))

	health := &handlers.Health{Version: d.Version, Ready: d.Ready}
	r.Get("/healthz", health.Liveness)
	r.Get("/readyz", health.Readiness)

	authH := &handlers.Auth{Sessions: d.Sessions, Issuer: d.Issuer, Logger: d.Logger}
	mboxH := &handlers.Mailboxes{Sessions: d.Sessions, Logger: d.Logger}
	msgH := &handlers.Messages{Sessions: d.Sessions, Sealer: d.Sealer, Sender: d.Sender, Logger: d.Logger}

	requireSession := middleware.RequireSession(d.Issuer, d.Sessions)

	r.Route("/api/v1", func(r chi.Router) {
		// Auth (login is rate-limited).
		r.Group(func(r chi.Router) {
			r.Use(rateLimit(d))
			r.Post("/auth/login", authH.Login)
		})
		r.With(requireSession).Post("/auth/logout", authH.Logout)

		// Mailboxes & messages (all require a valid session).
		r.Group(func(r chi.Router) {
			r.Use(requireSession)
			r.Get("/mailboxes", mboxH.List)
			r.Get("/mailboxes/{mailbox}/messages", mboxH.ListMessages)
			r.Get("/mailboxes/{mailbox}/changes", mboxH.Changes)
			r.Get("/mailboxes/{mailbox}/messages/{uid}", msgH.Get)
			r.Patch("/mailboxes/{mailbox}/messages/{uid}/flags", msgH.SetFlags)
			r.Delete("/mailboxes/{mailbox}/messages/{uid}", msgH.Delete)
			r.Post("/messages", msgH.Send)
		})
	})

	return r
}

// rateLimit returns the configured per-IP rate limiter middleware for login.
func rateLimit(d Deps) func(http.Handler) http.Handler {
	return middleware.PerIPRateLimit(d.RateLimitCtx, d.Config.RateLimitLoginPerMin)
}
