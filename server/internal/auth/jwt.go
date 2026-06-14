// Package auth issues and verifies JWTs used for session authentication.
//
// Tokens are signed with HS256. They carry a session_id and a subject (the
// user's email) plus standard exp/iat claims. We deliberately keep the surface
// minimal — the JWT is a pointer into the in-memory session store, not a
// credential carrier itself.
package auth

import (
	"errors"
	"fmt"
	"time"

	"github.com/golang-jwt/jwt/v5"
)

// Claims is the payload carried in Quicksilver session tokens.
type Claims struct {
	SessionID string `json:"sid"`
	jwt.RegisteredClaims
}

// Issuer creates signed tokens.
type Issuer struct {
	secret []byte
	ttl    time.Duration
}

// NewIssuer constructs an Issuer. Secret must be at least 32 bytes; the
// config layer enforces this, but we recheck for defence in depth.
func NewIssuer(secret string, ttl time.Duration) (*Issuer, error) {
	if len(secret) < 32 {
		return nil, errors.New("jwt secret too short")
	}
	if ttl <= 0 {
		return nil, errors.New("jwt ttl must be positive")
	}
	return &Issuer{secret: []byte(secret), ttl: ttl}, nil
}

// Issue creates a signed token for the given session and subject.
func (i *Issuer) Issue(sessionID, subject string) (string, time.Time, error) {
	now := time.Now()
	exp := now.Add(i.ttl)
	c := Claims{
		SessionID: sessionID,
		RegisteredClaims: jwt.RegisteredClaims{
			Subject:   subject,
			IssuedAt:  jwt.NewNumericDate(now),
			ExpiresAt: jwt.NewNumericDate(exp),
		},
	}
	tok := jwt.NewWithClaims(jwt.SigningMethodHS256, c)
	signed, err := tok.SignedString(i.secret)
	if err != nil {
		return "", time.Time{}, fmt.Errorf("sign token: %w", err)
	}
	return signed, exp, nil
}

// Verify parses and validates the token signature and expiry. The returned
// *Claims is only safe to read when err == nil.
func (i *Issuer) Verify(token string) (*Claims, error) {
	parsed, err := jwt.ParseWithClaims(token, &Claims{}, func(t *jwt.Token) (any, error) {
		if _, ok := t.Method.(*jwt.SigningMethodHMAC); !ok {
			return nil, fmt.Errorf("unexpected signing method: %v", t.Header["alg"])
		}
		return i.secret, nil
	}, jwt.WithValidMethods([]string{"HS256"}))
	if err != nil {
		return nil, err
	}
	c, ok := parsed.Claims.(*Claims)
	if !ok || !parsed.Valid {
		return nil, errors.New("invalid claims")
	}
	if c.SessionID == "" {
		return nil, errors.New("missing session id")
	}
	return c, nil
}
