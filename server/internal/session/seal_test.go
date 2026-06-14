package session

import (
	"bytes"
	"crypto/rand"
	"testing"

	"quicksilver/server/internal/mail"
)

func newKey(t *testing.T) []byte {
	t.Helper()
	b := make([]byte, 32)
	if _, err := rand.Read(b); err != nil {
		t.Fatal(err)
	}
	return b
}

func TestSealOpenRoundTrip(t *testing.T) {
	s, err := NewSealer(newKey(t))
	if err != nil {
		t.Fatal(err)
	}
	in := mail.Credentials{
		Email: "user@example.com", Password: "hunter2",
		IMAPHost: "imap.example.com", IMAPPort: 993, IMAPSecure: true,
		SMTPHost: "smtp.example.com", SMTPPort: 587, SMTPSecure: false,
	}
	blob, err := s.Seal(in)
	if err != nil {
		t.Fatalf("Seal: %v", err)
	}
	if bytes.Contains(blob, []byte("hunter2")) {
		t.Fatal("ciphertext contains plaintext password")
	}
	out, err := s.Open(blob)
	if err != nil {
		t.Fatalf("Open: %v", err)
	}
	if out != in {
		t.Fatalf("round-trip mismatch:\n got  %+v\n want %+v", out, in)
	}
}

func TestSealNonceIsRandom(t *testing.T) {
	s, _ := NewSealer(newKey(t))
	c := mail.Credentials{Email: "u@x", Password: "p"}
	a, _ := s.Seal(c)
	b, _ := s.Seal(c)
	if bytes.Equal(a, b) {
		t.Fatal("two seals of identical input produced identical ciphertexts (nonce is not random)")
	}
}

func TestOpenRejectsTampered(t *testing.T) {
	s, _ := NewSealer(newKey(t))
	blob, _ := s.Seal(mail.Credentials{Email: "u@x", Password: "p"})
	blob[len(blob)-1] ^= 0x01
	if _, err := s.Open(blob); err == nil {
		t.Fatal("expected error opening tampered ciphertext")
	}
}

func TestNewSealerRejectsBadKey(t *testing.T) {
	if _, err := NewSealer(make([]byte, 16)); err == nil {
		t.Fatal("expected error for short key")
	}
}
