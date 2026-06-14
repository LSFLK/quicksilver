package middleware

import (
	"context"
	"net/http"
	"sync"
	"time"

	"golang.org/x/time/rate"

	"quicksilver/server/internal/httpx"
)

// PerIPRateLimit returns a middleware that limits requests per remote IP using
// a token bucket. Each IP gets perMinute requests per minute with a burst of
// the same size. Stale entries are reaped periodically.
//
// Cancel ctx to stop the reaper goroutine.
func PerIPRateLimit(ctx context.Context, perMinute int) func(http.Handler) http.Handler {
	if perMinute <= 0 {
		perMinute = 60
	}
	rl := newIPLimiter(perMinute, time.Minute)
	go rl.reapLoop(ctx, 5*time.Minute)
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			ip := clientIP(r)
			if !rl.allow(ip) {
				w.Header().Set("Retry-After", "60")
				httpx.WriteError(w, r, nil, httpx.NewAPIError(http.StatusTooManyRequests, httpx.CodeRateLimited, "rate limit exceeded", nil))
				return
			}
			next.ServeHTTP(w, r)
		})
	}
}

type ipLimiter struct {
	limit  rate.Limit
	burst  int
	mu     sync.Mutex
	limits map[string]*limiterEntry
}

type limiterEntry struct {
	lim  *rate.Limiter
	seen time.Time
}

func newIPLimiter(perWindow int, window time.Duration) *ipLimiter {
	return &ipLimiter{
		limit:  rate.Limit(float64(perWindow) / window.Seconds()),
		burst:  perWindow,
		limits: make(map[string]*limiterEntry),
	}
}

func (l *ipLimiter) allow(ip string) bool {
	l.mu.Lock()
	e, ok := l.limits[ip]
	if !ok {
		e = &limiterEntry{lim: rate.NewLimiter(l.limit, l.burst)}
		l.limits[ip] = e
	}
	e.seen = time.Now()
	l.mu.Unlock()
	return e.lim.Allow()
}

func (l *ipLimiter) reapLoop(ctx context.Context, interval time.Duration) {
	t := time.NewTicker(interval)
	defer t.Stop()
	for {
		select {
		case <-ctx.Done():
			return
		case <-t.C:
			l.reap(10 * time.Minute)
		}
	}
}

func (l *ipLimiter) reap(idleFor time.Duration) {
	cutoff := time.Now().Add(-idleFor)
	l.mu.Lock()
	defer l.mu.Unlock()
	for ip, e := range l.limits {
		if e.seen.Before(cutoff) {
			delete(l.limits, ip)
		}
	}
}
