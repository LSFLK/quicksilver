// Command server runs the Quicksilver HTTP API.
package main

import (
	"context"
	"errors"
	"log/slog"
	"net/http"
	"os"
	"os/signal"
	"syscall"

	"github.com/joho/godotenv"

	"quicksilver/server/internal/auth"
	"quicksilver/server/internal/config"
	apihttp "quicksilver/server/internal/http"
	applog "quicksilver/server/internal/log"
	"quicksilver/server/internal/realtime"
	"quicksilver/server/internal/session"
	"quicksilver/server/internal/smtp"
)

// version is overridden at link time: -ldflags "-X main.version=$(git describe)"
var version = "dev"

func main() {
	// .env is optional and only consulted for local dev; production should
	// inject environment variables via the orchestrator.
	_ = godotenv.Load()

	cfg, err := config.Load()
	if err != nil {
		slog.New(slog.NewJSONHandler(os.Stderr, nil)).Error("config", "err", err)
		os.Exit(1)
	}

	logger := applog.New(cfg.LogLevel, cfg.LogFormat, os.Stdout)
	slog.SetDefault(logger)

	logger.Info("starting",
		"version", version,
		"addr", cfg.Address(),
		"tls", cfg.TLSEnabled(),
		"allowed_origins", cfg.AllowedOriginsCSV(),
	)

	// Background context for long-running goroutines (session sweeper, rate-limit reaper).
	bgCtx, bgCancel := context.WithCancel(context.Background())
	defer bgCancel()

	sealer, err := session.NewSealer(cfg.SealKey())
	if err != nil {
		logger.Error("init sealer", "err", err)
		os.Exit(1)
	}
	issuer, err := auth.NewIssuer(cfg.JWTSecret, cfg.JWTTTL)
	if err != nil {
		logger.Error("init issuer", "err", err)
		os.Exit(1)
	}
	sessions := session.NewStore(bgCtx, sealer, cfg.SessionIdleTTL, cfg.SessionSweepInt, cfg.IMAPTimeout, logger)
	sender := smtp.New(cfg.SMTPTimeout)
	hub := realtime.NewHub(logger)

	router := apihttp.NewRouter(apihttp.Deps{
		Config:       cfg,
		Logger:       logger,
		Version:      version,
		Ready:        func() error { return nil },
		Sessions:     sessions,
		Issuer:       issuer,
		Sealer:       sealer,
		Sender:       sender,
		Hub:          hub,
		RateLimitCtx: bgCtx,
	})

	srv := &http.Server{
		Addr:              cfg.Address(),
		Handler:           router,
		ReadHeaderTimeout: cfg.ReadHeaderTimeout,
		WriteTimeout:      cfg.WriteTimeout,
		IdleTimeout:       cfg.IdleTimeout,
		ErrorLog:          slog.NewLogLogger(logger.Handler(), slog.LevelError),
	}

	errCh := make(chan error, 1)
	go func() {
		var err error
		if cfg.TLSEnabled() {
			err = srv.ListenAndServeTLS(cfg.TLSCert, cfg.TLSKey)
		} else {
			err = srv.ListenAndServe()
		}
		if err != nil && !errors.Is(err, http.ErrServerClosed) {
			errCh <- err
		}
	}()

	sigCh := make(chan os.Signal, 1)
	signal.Notify(sigCh, syscall.SIGINT, syscall.SIGTERM)

	select {
	case sig := <-sigCh:
		logger.Info("shutdown signal received", "signal", sig.String())
	case err := <-errCh:
		logger.Error("listener exited", "err", err)
		os.Exit(1)
	}

	shutdownCtx, cancel := context.WithTimeout(context.Background(), cfg.ShutdownTimeout)
	defer cancel()
	if err := srv.Shutdown(shutdownCtx); err != nil {
		logger.Error("graceful shutdown failed", "err", err)
		os.Exit(1)
	}
	bgCancel() // triggers session sweeper to close all live IMAP connections.
	logger.Info("shutdown complete")
}
