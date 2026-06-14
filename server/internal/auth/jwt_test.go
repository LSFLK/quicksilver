package auth

import (
	"strings"
	"testing"
	"time"
)

func newTestIssuer(t *testing.T) *Issuer {
	t.Helper()
	i, err := NewIssuer(strings.Repeat("k", 32), 5*time.Minute)
	if err != nil {
		t.Fatalf("NewIssuer: %v", err)
	}
	return i
}

func TestIssuerRoundTrip(t *testing.T) {
	i := newTestIssuer(t)
	tok, exp, err := i.Issue("sess-abc", "user@example.com")
	if err != nil {
		t.Fatalf("Issue: %v", err)
	}
	if tok == "" || exp.Before(time.Now()) {
		t.Fatalf("bad token/exp: %q / %v", tok, exp)
	}
	c, err := i.Verify(tok)
	if err != nil {
		t.Fatalf("Verify: %v", err)
	}
	if c.SessionID != "sess-abc" {
		t.Errorf("sid: got %q want sess-abc", c.SessionID)
	}
	if c.Subject != "user@example.com" {
		t.Errorf("sub: got %q want user@example.com", c.Subject)
	}
}

func TestIssuerRejectsShortSecret(t *testing.T) {
	if _, err := NewIssuer("tooshort", time.Minute); err == nil {
		t.Fatal("expected error for short secret")
	}
}

func TestVerifyRejectsTamperedToken(t *testing.T) {
	i := newTestIssuer(t)
	tok, _, _ := i.Issue("sess-abc", "user@example.com")
	// flip the last byte of the signature
	tampered := tok[:len(tok)-1] + "x"
	if tampered == tok {
		tampered = tok[:len(tok)-1] + "y"
	}
	if _, err := i.Verify(tampered); err == nil {
		t.Fatal("expected verification to fail on tampered token")
	}
}

func TestVerifyRejectsWrongSecret(t *testing.T) {
	i1, _ := NewIssuer(strings.Repeat("a", 32), time.Minute)
	i2, _ := NewIssuer(strings.Repeat("b", 32), time.Minute)
	tok, _, _ := i1.Issue("sess", "user@example.com")
	if _, err := i2.Verify(tok); err == nil {
		t.Fatal("expected error verifying with wrong secret")
	}
}

func TestVerifyRejectsExpired(t *testing.T) {
	i, err := NewIssuer(strings.Repeat("k", 32), 1*time.Nanosecond)
	if err != nil {
		t.Fatal(err)
	}
	tok, _, _ := i.Issue("sess", "user@example.com")
	time.Sleep(10 * time.Millisecond)
	if _, err := i.Verify(tok); err == nil {
		t.Fatal("expected error verifying expired token")
	}
}
