package session

import (
	"context"
	"crypto/rand"
	"encoding/hex"
	"errors"
	"fmt"
	"log/slog"
	"sync"
	"time"

	"quicksilver/server/internal/imap"
	"quicksilver/server/internal/mail"
)

// Session is one authenticated user. Mutations are serialised via the embedded
// mutex; callers MUST hold the lock when touching mutable fields directly.
type Session struct {
	ID          string
	Subject     string // user email
	IMAPSummary IMAPSummary
	SMTPSummary SMTPSummary

	mu        sync.Mutex
	sealed    []byte
	imap      *imap.Client
	lastSeen  time.Time
	createdAt time.Time
}

// IMAPSummary / SMTPSummary expose non-secret connection metadata for
// display and audit logging.
type IMAPSummary struct {
	Host   string
	Port   int
	Secure bool
}
type SMTPSummary struct {
	Host   string
	Port   int
	Secure bool
}

// Touch updates the last-seen timestamp.
func (s *Session) Touch() {
	s.mu.Lock()
	s.lastSeen = time.Now()
	s.mu.Unlock()
}

// LastSeen returns when the session was last accessed.
func (s *Session) LastSeen() time.Time {
	s.mu.Lock()
	t := s.lastSeen
	s.mu.Unlock()
	return t
}

// IMAP returns the live IMAP client, reconnecting if needed.
func (s *Session) IMAP(ctx context.Context) (*imap.Client, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	if s.imap != nil {
		if err := s.imap.Ping(ctx); err == nil {
			return s.imap, nil
		}
		_ = s.imap.Close()
		s.imap = nil
	}
	return nil, errors.New("imap connection lost") // store re-establishment lives in the Store
}

// Credentials unseals and returns the user's credentials. Intended for the
// short-lived SMTP send path; callers must not retain the returned struct.
func (s *Session) Credentials(sealer *Sealer) (mail.Credentials, error) {
	s.mu.Lock()
	sealed := s.sealed
	s.mu.Unlock()
	return sealer.Open(sealed)
}

// Store holds active sessions in process memory.
type Store struct {
	sealer        *Sealer
	idleTTL       time.Duration
	sweepInterval time.Duration
	imapTimeout   time.Duration
	logger        *slog.Logger

	mu       sync.RWMutex
	sessions map[string]*Session
}

// NewStore constructs a Store and starts the idle-eviction sweeper.
// Cancel ctx to stop sweeping; remaining sessions will be closed.
func NewStore(ctx context.Context, sealer *Sealer, idleTTL, sweepInterval, imapTimeout time.Duration, logger *slog.Logger) *Store {
	s := &Store{
		sealer:        sealer,
		idleTTL:       idleTTL,
		sweepInterval: sweepInterval,
		imapTimeout:   imapTimeout,
		logger:        logger,
		sessions:      make(map[string]*Session),
	}
	go s.sweepLoop(ctx)
	return s
}

// Create authenticates the supplied credentials against the IMAP server,
// stores a new session, and returns it.
func (s *Store) Create(ctx context.Context, creds mail.Credentials) (*Session, error) {
	if err := validateCreds(creds); err != nil {
		return nil, err
	}
	c, err := imap.New(ctx, creds, s.imapTimeout, s.logger)
	if err != nil {
		return nil, err
	}
	sealed, err := s.sealer.Seal(creds)
	if err != nil {
		_ = c.Close()
		return nil, fmt.Errorf("seal creds: %w", err)
	}
	id, err := newID()
	if err != nil {
		_ = c.Close()
		return nil, err
	}
	now := time.Now()
	sess := &Session{
		ID:          id,
		Subject:     creds.Email,
		IMAPSummary: IMAPSummary{Host: creds.IMAPHost, Port: creds.IMAPPort, Secure: creds.IMAPSecure},
		SMTPSummary: SMTPSummary{Host: creds.SMTPHost, Port: creds.SMTPPort, Secure: creds.SMTPSecure},
		sealed:      sealed,
		imap:        c,
		lastSeen:    now,
		createdAt:   now,
	}
	s.mu.Lock()
	s.sessions[id] = sess
	s.mu.Unlock()
	s.logger.Info("session created", "session_id", id, "email", creds.Email)
	return sess, nil
}

// Get returns the session by id and refreshes its last-seen timestamp.
func (s *Store) Get(id string) (*Session, bool) {
	s.mu.RLock()
	sess, ok := s.sessions[id]
	s.mu.RUnlock()
	if !ok {
		return nil, false
	}
	sess.Touch()
	return sess, true
}

// IMAPFor returns the live IMAP client for the session, transparently
// reconnecting from sealed credentials if there is no connection yet.
//
// We deliberately do NOT probe the existing connection with a NOOP here: every
// Client operation already calls ensureLive, which NOOPs and self-heals from the
// stored credentials on failure. Probing here too would add a full extra
// round-trip to the IMAP server (~one RTT) on every request for no benefit.
func (s *Store) IMAPFor(ctx context.Context, sess *Session) (*imap.Client, error) {
	sess.mu.Lock()
	defer sess.mu.Unlock()
	if sess.imap != nil {
		return sess.imap, nil
	}
	creds, err := s.sealer.Open(sess.sealed)
	if err != nil {
		return nil, fmt.Errorf("unseal creds: %w", err)
	}
	c, err := imap.New(ctx, creds, s.imapTimeout, s.logger)
	if err != nil {
		return nil, err
	}
	sess.imap = c
	return c, nil
}

// Delete removes the session and closes its IMAP connection.
func (s *Store) Delete(id string) {
	s.mu.Lock()
	sess, ok := s.sessions[id]
	if ok {
		delete(s.sessions, id)
	}
	s.mu.Unlock()
	if !ok {
		return
	}
	sess.mu.Lock()
	c := sess.imap
	sess.imap = nil
	// zero the sealed blob so it can't be recovered from a heap dump after deletion.
	for i := range sess.sealed {
		sess.sealed[i] = 0
	}
	sess.mu.Unlock()
	if c != nil {
		_ = c.Close()
	}
	s.logger.Info("session deleted", "session_id", id)
}

// Count returns the number of active sessions. For metrics/tests.
func (s *Store) Count() int {
	s.mu.RLock()
	defer s.mu.RUnlock()
	return len(s.sessions)
}

func (s *Store) sweepLoop(ctx context.Context) {
	t := time.NewTicker(s.sweepInterval)
	defer t.Stop()
	for {
		select {
		case <-ctx.Done():
			s.shutdown()
			return
		case <-t.C:
			s.sweep()
		}
	}
}

func (s *Store) sweep() {
	cutoff := time.Now().Add(-s.idleTTL)
	s.mu.RLock()
	var stale []string
	for id, sess := range s.sessions {
		if sess.LastSeen().Before(cutoff) {
			stale = append(stale, id)
		}
	}
	s.mu.RUnlock()
	for _, id := range stale {
		s.logger.Info("evicting idle session", "session_id", id)
		s.Delete(id)
	}
}

func (s *Store) shutdown() {
	s.mu.Lock()
	ids := make([]string, 0, len(s.sessions))
	for id := range s.sessions {
		ids = append(ids, id)
	}
	s.mu.Unlock()
	for _, id := range ids {
		s.Delete(id)
	}
}

func validateCreds(c mail.Credentials) error {
	switch {
	case c.Email == "":
		return errors.New("email is required")
	case c.Password == "":
		return errors.New("password is required")
	case c.IMAPHost == "" || c.IMAPPort == 0:
		return errors.New("imap host and port are required")
	case c.SMTPHost == "" || c.SMTPPort == 0:
		return errors.New("smtp host and port are required")
	}
	return nil
}

func newID() (string, error) {
	var b [24]byte
	if _, err := rand.Read(b[:]); err != nil {
		return "", fmt.Errorf("rand: %w", err)
	}
	return "sess-" + hex.EncodeToString(b[:]), nil
}
