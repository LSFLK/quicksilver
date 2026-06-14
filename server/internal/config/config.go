// Package config loads server configuration from environment variables.
//
// All settings are namespaced under QUICKSILVER_*. Required values cause boot to fail
// rather than running with insecure defaults.
package config

import (
	"encoding/hex"
	"errors"
	"fmt"
	"strings"
	"time"

	"github.com/kelseyhightower/envconfig"
)

const envPrefix = "QUICKSILVER"

// Config is the resolved server configuration.
type Config struct {
	Port int `envconfig:"PORT" default:"8080"`

	JWTSecret string        `envconfig:"JWT_SECRET" required:"true"`
	JWTTTL    time.Duration `envconfig:"JWT_TTL" default:"24h"`

	SessionIdleTTL  time.Duration `envconfig:"SESSION_IDLE_TTL" default:"30m"`
	SessionSealKey  string        `envconfig:"SESSION_SEAL_KEY" required:"true"`
	sessionSealKey  []byte
	SessionSweepInt time.Duration `envconfig:"SESSION_SWEEP_INTERVAL" default:"1m"`

	AllowedOrigins []string `envconfig:"ALLOWED_ORIGINS" default:"http://localhost:3000"`

	LogLevel  string `envconfig:"LOG_LEVEL" default:"info"`
	LogFormat string `envconfig:"LOG_FORMAT" default:"json"`

	IMAPTimeout time.Duration `envconfig:"IMAP_TIMEOUT" default:"30s"`
	SMTPTimeout time.Duration `envconfig:"SMTP_TIMEOUT" default:"30s"`

	RateLimitLoginPerMin int `envconfig:"RATE_LIMIT_LOGIN_PER_MIN" default:"10"`

	TLSCert string `envconfig:"TLS_CERT"`
	TLSKey  string `envconfig:"TLS_KEY"`

	ReadHeaderTimeout time.Duration `envconfig:"READ_HEADER_TIMEOUT" default:"10s"`
	WriteTimeout      time.Duration `envconfig:"WRITE_TIMEOUT" default:"60s"`
	IdleTimeout       time.Duration `envconfig:"IDLE_TIMEOUT" default:"120s"`
	ShutdownTimeout   time.Duration `envconfig:"SHUTDOWN_TIMEOUT" default:"15s"`
}

// Load reads configuration from the process environment.
func Load() (*Config, error) {
	var c Config
	if err := envconfig.Process(envPrefix, &c); err != nil {
		return nil, fmt.Errorf("load env: %w", err)
	}
	if err := c.validate(); err != nil {
		return nil, err
	}
	return &c, nil
}

func (c *Config) validate() error {
	if len(c.JWTSecret) < 32 {
		return errors.New("QUICKSILVER_JWT_SECRET must be at least 32 characters")
	}
	key, err := hex.DecodeString(c.SessionSealKey)
	if err != nil {
		return fmt.Errorf("QUICKSILVER_SESSION_SEAL_KEY must be hex-encoded: %w", err)
	}
	if len(key) != 32 {
		return errors.New("QUICKSILVER_SESSION_SEAL_KEY must decode to 32 bytes (64 hex chars)")
	}
	c.sessionSealKey = key

	if (c.TLSCert == "") != (c.TLSKey == "") {
		return errors.New("QUICKSILVER_TLS_CERT and QUICKSILVER_TLS_KEY must both be set or both empty")
	}
	if c.RateLimitLoginPerMin <= 0 {
		return errors.New("QUICKSILVER_RATE_LIMIT_LOGIN_PER_MIN must be positive")
	}
	return nil
}

// SealKey returns the decoded 32-byte AES key for sealing session secrets.
func (c *Config) SealKey() []byte { return c.sessionSealKey }

// TLSEnabled reports whether a TLS cert and key were configured.
func (c *Config) TLSEnabled() bool { return c.TLSCert != "" && c.TLSKey != "" }

// Address returns the host:port listen address.
func (c *Config) Address() string {
	return fmt.Sprintf(":%d", c.Port)
}

// AllowedOriginsCSV returns the configured origins joined by commas for logging.
func (c *Config) AllowedOriginsCSV() string {
	return strings.Join(c.AllowedOrigins, ",")
}
