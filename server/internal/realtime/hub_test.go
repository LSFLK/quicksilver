package realtime

import (
	"context"
	"io"
	"log/slog"
	"testing"
	"time"

	"quicksilver/server/internal/imap"
)

func testHub() *Hub {
	return NewHub(slog.New(slog.NewTextHandler(io.Discard, nil)))
}

// errDial never connects, so the watcher goroutine just loops in backoff and
// never calls broadcast — letting us drive broadcast manually.
func errDial(context.Context) (*imap.Client, error) {
	return nil, context.Canceled
}

func sessionHubFor(t *testing.T, h *Hub, id string) *sessionHub {
	t.Helper()
	h.mu.Lock()
	defer h.mu.Unlock()
	sh, ok := h.sessions[id]
	if !ok {
		t.Fatalf("no sessionHub for %q", id)
	}
	return sh
}

func TestWatcherRefCountingAndBroadcast(t *testing.T) {
	h := testHub()

	subA, cleanupA := h.Subscribe("sess-1", errDial, []string{"INBOX"})
	subB, cleanupB := h.Subscribe("sess-1", errDial, []string{"INBOX"})

	sh := sessionHubFor(t, h, "sess-1")

	// One shared watcher for INBOX, referenced twice.
	sh.mu.Lock()
	w := sh.watchers["INBOX"]
	refs := 0
	if w != nil {
		refs = w.refs
	}
	nSubs := len(sh.subs)
	sh.mu.Unlock()
	if w == nil {
		t.Fatal("expected an INBOX watcher")
	}
	if refs != 2 {
		t.Fatalf("watcher refs = %d, want 2", refs)
	}
	if nSubs != 2 {
		t.Fatalf("subs = %d, want 2", nSubs)
	}

	// A broadcast reaches every subscriber watching the mailbox.
	sh.broadcast("INBOX")
	for name, sub := range map[string]*Subscriber{"A": subA, "B": subB} {
		select {
		case ev := <-sub.C:
			if ev.Mailbox != "INBOX" {
				t.Fatalf("sub %s got mailbox %q, want INBOX", name, ev.Mailbox)
			}
		case <-time.After(time.Second):
			t.Fatalf("sub %s received no event", name)
		}
	}

	// Dropping one subscriber keeps the shared watcher alive.
	cleanupA()
	sh.mu.Lock()
	w = sh.watchers["INBOX"]
	if w == nil || w.refs != 1 {
		sh.mu.Unlock()
		t.Fatalf("after cleanupA: watcher should remain with refs=1")
	}
	sh.mu.Unlock()

	// Dropping the last subscriber tears the watcher down and evicts the session.
	cleanupB()
	sh.mu.Lock()
	remaining := len(sh.watchers) + len(sh.subs)
	sh.mu.Unlock()
	if remaining != 0 {
		t.Fatalf("after cleanupB: watchers+subs = %d, want 0", remaining)
	}

	h.mu.Lock()
	_, stillThere := h.sessions["sess-1"]
	h.mu.Unlock()
	if stillThere {
		t.Fatal("session should be evicted once empty")
	}
}

func TestBroadcastSkipsUnwatchedMailbox(t *testing.T) {
	h := testHub()
	sub, cleanup := h.Subscribe("sess-2", errDial, []string{"INBOX"})
	defer cleanup()

	sh := sessionHubFor(t, h, "sess-2")
	sh.broadcast("Sent") // sub watches INBOX only

	select {
	case ev := <-sub.C:
		t.Fatalf("unexpected event for unwatched mailbox: %q", ev.Mailbox)
	case <-time.After(100 * time.Millisecond):
		// good: nothing delivered
	}
}

func TestCleanupIsIdempotent(t *testing.T) {
	h := testHub()
	_, cleanup := h.Subscribe("sess-3", errDial, []string{"INBOX"})
	cleanup()
	cleanup() // must not double-decrement or panic
}
