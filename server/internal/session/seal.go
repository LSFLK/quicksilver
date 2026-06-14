// Package session manages authenticated user sessions in process memory.
//
// Each session holds the IMAP credentials sealed via AES-GCM so a memory dump
// of the process doesn't trivially reveal them. The sealing key (32 bytes,
// supplied via QUICKSILVER_SESSION_SEAL_KEY) is held only in this process.
package session

import (
	"crypto/aes"
	"crypto/cipher"
	"crypto/rand"
	"encoding/json"
	"errors"
	"fmt"

	"quicksilver/server/internal/mail"
)

// Sealer encrypts and decrypts mail.Credentials with AES-GCM.
type Sealer struct {
	gcm cipher.AEAD
}

// NewSealer constructs a Sealer from a 32-byte AES key.
func NewSealer(key []byte) (*Sealer, error) {
	if len(key) != 32 {
		return nil, errors.New("seal key must be 32 bytes")
	}
	block, err := aes.NewCipher(key)
	if err != nil {
		return nil, fmt.Errorf("new cipher: %w", err)
	}
	gcm, err := cipher.NewGCM(block)
	if err != nil {
		return nil, fmt.Errorf("new gcm: %w", err)
	}
	return &Sealer{gcm: gcm}, nil
}

// Seal encrypts the credentials. The nonce is prepended to the ciphertext.
func (s *Sealer) Seal(c mail.Credentials) ([]byte, error) {
	plain, err := json.Marshal(c)
	if err != nil {
		return nil, fmt.Errorf("marshal creds: %w", err)
	}
	nonce := make([]byte, s.gcm.NonceSize())
	if _, err := rand.Read(nonce); err != nil {
		return nil, fmt.Errorf("read nonce: %w", err)
	}
	return s.gcm.Seal(nonce, nonce, plain, nil), nil
}

// Open reverses Seal.
func (s *Sealer) Open(sealed []byte) (mail.Credentials, error) {
	var c mail.Credentials
	if len(sealed) < s.gcm.NonceSize() {
		return c, errors.New("sealed blob too short")
	}
	nonce, ct := sealed[:s.gcm.NonceSize()], sealed[s.gcm.NonceSize():]
	plain, err := s.gcm.Open(nil, nonce, ct, nil)
	if err != nil {
		return c, fmt.Errorf("open: %w", err)
	}
	if err := json.Unmarshal(plain, &c); err != nil {
		return c, fmt.Errorf("unmarshal creds: %w", err)
	}
	return c, nil
}
