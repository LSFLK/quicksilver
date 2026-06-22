// Package realtime implements the server-push half of the sync protocol
// (proposal §6, Phase 4). For each connected client it holds one IMAP IDLE
// connection per watched mailbox; when IDLE fires, it pushes a tiny "changed"
// event to that client's SSE subscribers, which then run an incremental sync.
//
// The event carries only the mailbox name — no message data — keeping the push
// lightweight. The actual delta is pulled over the regular REST API afterwards.
//
// Concurrency: a Hub owns a sessionHub per session id. Watchers are reference
// counted by mailbox so N browser tabs watching the same folder share one IDLE
// connection, and the connection is torn down when the last subscriber leaves.
// Lock order is always Hub.mu → sessionHub.mu; no path acquires them the other
// way round.
package realtime

import (
	"context"
	"log/slog"
	"sync"
	"time"

	"quicksilver/server/internal/imap"
)

// ChangeEvent is the payload pushed to the client when a watched mailbox
// changes. It deliberately carries no message data.
type ChangeEvent struct {
	Mailbox string `json:"mailbox"`
}

// Dialer opens a fresh, dedicated IMAP connection for watching. The watcher
// owns the returned client and closes it when the watch ends.
type Dialer func(ctx context.Context) (*imap.Client, error)

// Hub fans IMAP IDLE activity out to SSE subscribers, keyed by session.
type Hub struct {
	logger *slog.Logger

	mu       sync.Mutex
	sessions map[string]*sessionHub
}

// NewHub constructs an empty Hub.
func NewHub(logger *slog.Logger) *Hub {
	return &Hub{logger: logger, sessions: make(map[string]*sessionHub)}
}

// Subscriber is one SSE connection. The handler ranges over C and writes each
// event to the wire; events are dropped (never block) if the consumer lags.
type Subscriber struct {
	C         chan ChangeEvent
	mailboxes map[string]bool
}

// Subscribe registers an SSE consumer for the given session and mailboxes,
// starting (or reusing) an IDLE watcher per mailbox. The returned cleanup func
// must be called exactly once when the SSE connection ends; it decrements the
// watchers and tears down any that reach zero subscribers.
func (h *Hub) Subscribe(sessionID string, dial Dialer, mailboxes []string) (*Subscriber, func()) {
	h.mu.Lock()
	sh := h.sessions[sessionID]
	if sh == nil {
		sh = &sessionHub{
			hub:      h,
			id:       sessionID,
			dial:     dial,
			subs:     make(map[*Subscriber]struct{}),
			watchers: make(map[string]*watcher),
		}
		h.sessions[sessionID] = sh
	}
	h.mu.Unlock()
	return sh.add(mailboxes)
}

func (h *Hub) removeIfEmpty(id string) {
	h.mu.Lock()
	defer h.mu.Unlock()
	sh, ok := h.sessions[id]
	if !ok {
		return
	}
	sh.mu.Lock()
	empty := len(sh.subs) == 0 && len(sh.watchers) == 0
	sh.mu.Unlock()
	if empty {
		delete(h.sessions, id)
	}
}

// sessionHub holds all subscribers and watchers for a single session.
type sessionHub struct {
	hub  *Hub
	id   string
	dial Dialer

	mu       sync.Mutex
	subs     map[*Subscriber]struct{}
	watchers map[string]*watcher
}

type watcher struct {
	refs   int
	cancel context.CancelFunc
}

func (sh *sessionHub) add(mailboxes []string) (*Subscriber, func()) {
	sub := &Subscriber{C: make(chan ChangeEvent, 8), mailboxes: make(map[string]bool)}

	sh.mu.Lock()
	sh.subs[sub] = struct{}{}
	for _, m := range mailboxes {
		if m == "" || sub.mailboxes[m] {
			continue
		}
		sub.mailboxes[m] = true
		w := sh.watchers[m]
		if w == nil {
			ctx, cancel := context.WithCancel(context.Background())
			w = &watcher{cancel: cancel}
			sh.watchers[m] = w
			go sh.runWatcher(ctx, m)
		}
		w.refs++
	}
	sh.mu.Unlock()

	var once sync.Once
	cleanup := func() {
		once.Do(func() {
			sh.mu.Lock()
			delete(sh.subs, sub)
			for m := range sub.mailboxes {
				if w := sh.watchers[m]; w != nil {
					w.refs--
					if w.refs <= 0 {
						w.cancel()
						delete(sh.watchers, m)
					}
				}
			}
			sh.mu.Unlock()
			// We never close sub.C: broadcast only sends to subs still in the
			// map (under sh.mu), and we removed this one above, so no send can
			// race a close. The channel is simply GC'd with the Subscriber.
			sh.hub.removeIfEmpty(sh.id)
		})
	}
	return sub, cleanup
}

// runWatcher keeps a dedicated IDLE connection alive for one mailbox, calling
// broadcast on every change and reconnecting (with capped backoff) until ctx is
// cancelled — the periodic safety re-sync against connection drops noted in the
// proposal's risk table.
func (sh *sessionHub) runWatcher(ctx context.Context, mailbox string) {
	const (
		minBackoff = 1 * time.Second
		maxBackoff = 30 * time.Second
	)
	backoff := minBackoff
	for {
		if ctx.Err() != nil {
			return
		}
		c, err := sh.dial(ctx)
		if err != nil {
			sh.hub.logger.Warn("realtime: dial failed", "session_id", sh.id, "mailbox", mailbox, "err", err)
			if !sleepCtx(ctx, backoff) {
				return
			}
			backoff = next(backoff, maxBackoff)
			continue
		}
		backoff = minBackoff // a successful connect resets the backoff
		err = c.Watch(ctx, mailbox, func() { sh.broadcast(mailbox) })
		_ = c.Close()
		if ctx.Err() != nil {
			return
		}
		sh.hub.logger.Info("realtime: watch ended, reconnecting", "session_id", sh.id, "mailbox", mailbox, "err", err)
		if !sleepCtx(ctx, backoff) {
			return
		}
		backoff = next(backoff, maxBackoff)
	}
}

func (sh *sessionHub) broadcast(mailbox string) {
	ev := ChangeEvent{Mailbox: mailbox}
	sh.mu.Lock()
	sh.hub.logger.Info("realtime: change detected", "session_id", sh.id, "mailbox", mailbox, "subscribers", len(sh.subs))
	for sub := range sh.subs {
		if !sub.mailboxes[mailbox] {
			continue
		}
		// Non-blocking: a lagging consumer drops this signal and catches up on
		// its next sync — the events are coalescible by design.
		select {
		case sub.C <- ev:
		default:
		}
	}
	sh.mu.Unlock()
}

// sleepCtx sleeps for d or until ctx is cancelled. Reports false if cancelled.
func sleepCtx(ctx context.Context, d time.Duration) bool {
	t := time.NewTimer(d)
	defer t.Stop()
	select {
	case <-ctx.Done():
		return false
	case <-t.C:
		return true
	}
}

func next(d, max time.Duration) time.Duration {
	d *= 2
	if d > max {
		return max
	}
	return d
}
