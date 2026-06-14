// Package imap wraps github.com/emersion/go-imap with a thread-safe,
// reconnect-capable client tailored to the Quicksilver API.
//
// A go-imap *client.Client is not safe for concurrent use; this wrapper
// serialises operations via an internal mutex. Connections that look dead are
// transparently re-established from the stored credentials before the next
// operation runs.
package imap

import (
	"context"
	"errors"
	"fmt"
	"io"
	"log/slog"
	"net"
	"strings"
	"sync"
	"time"

	"github.com/emersion/go-imap"
	"github.com/emersion/go-imap/client"
	"github.com/emersion/go-message"
	_ "github.com/emersion/go-message/charset" // register common charsets
	gomail "github.com/emersion/go-message/mail"

	hmail "quicksilver/server/internal/mail"
)

// Client is a thread-safe, reconnecting IMAP client.
type Client struct {
	mu       sync.Mutex
	creds    hmail.Credentials
	timeout  time.Duration
	logger   *slog.Logger
	conn     *client.Client
	selected string // currently SELECTed mailbox (case-sensitive on the wire)
}

// New dials the IMAP server and authenticates. The returned client owns the
// underlying connection until Close is called.
func New(ctx context.Context, creds hmail.Credentials, timeout time.Duration, logger *slog.Logger) (*Client, error) {
	c := &Client{creds: creds, timeout: timeout, logger: logger}
	if err := c.connect(ctx); err != nil {
		return nil, err
	}
	return c, nil
}

func (c *Client) connect(ctx context.Context) error {
	addr := net.JoinHostPort(c.creds.IMAPHost, fmt.Sprintf("%d", c.creds.IMAPPort))
	deadline, cancel := contextDeadline(ctx, c.timeout)
	defer cancel()

	var (
		conn *client.Client
		err  error
	)
	dialer := &net.Dialer{Deadline: deadline}
	if c.creds.IMAPSecure {
		conn, err = client.DialWithDialerTLS(dialer, addr, nil)
	} else {
		conn, err = client.DialWithDialer(dialer, addr)
	}
	if err != nil {
		return fmt.Errorf("dial imap %s: %w", addr, err)
	}
	conn.Timeout = c.timeout

	if err := conn.Login(c.creds.Email, c.creds.Password); err != nil {
		_ = conn.Logout()
		return fmt.Errorf("imap login: %w", err)
	}
	c.conn = conn
	c.selected = ""
	return nil
}

// ensureLive returns the current connection, reconnecting on noop failure.
//
// Caller must hold c.mu.
func (c *Client) ensureLive(ctx context.Context) error {
	if c.conn != nil {
		if err := c.conn.Noop(); err == nil {
			return nil
		}
		// Connection looks dead — close and fall through to reconnect.
		_ = c.conn.Logout()
		c.conn = nil
	}
	return c.connect(ctx)
}

// Close logs out and closes the underlying connection. Safe to call once.
func (c *Client) Close() error {
	c.mu.Lock()
	defer c.mu.Unlock()
	if c.conn == nil {
		return nil
	}
	err := c.conn.Logout()
	c.conn = nil
	return err
}

// Ping issues a NOOP to keep the connection warm.
func (c *Client) Ping(ctx context.Context) error {
	c.mu.Lock()
	defer c.mu.Unlock()
	return c.ensureLive(ctx)
}

// ListMailboxes lists all mailboxes visible to the user.
func (c *Client) ListMailboxes(ctx context.Context) ([]hmail.Mailbox, error) {
	c.mu.Lock()
	defer c.mu.Unlock()
	if err := c.ensureLive(ctx); err != nil {
		return nil, err
	}
	ch := make(chan *imap.MailboxInfo, 32)
	done := make(chan error, 1)
	go func() { done <- c.conn.List("", "*", ch) }()

	var out []hmail.Mailbox
	for info := range ch {
		out = append(out, mailboxFromInfo(info))
	}
	if err := <-done; err != nil {
		return nil, fmt.Errorf("list mailboxes: %w", err)
	}
	return out, nil
}

func mailboxFromInfo(info *imap.MailboxInfo) hmail.Mailbox {
	role := ""
	for _, a := range info.Attributes {
		switch strings.ToLower(a) {
		case "\\inbox":
			role = "inbox"
		case "\\sent":
			role = "sent"
		case "\\drafts":
			role = "drafts"
		case "\\trash":
			role = "trash"
		case "\\junk", "\\spam":
			role = "junk"
		case "\\archive":
			role = "archive"
		}
	}
	if role == "" && strings.EqualFold(info.Name, "INBOX") {
		role = "inbox"
	}
	return hmail.Mailbox{
		Name:      info.Name,
		Delimiter: info.Delimiter,
		Flags:     info.Attributes,
		Role:      role,
	}
}

func (c *Client) selectMailbox(name string, readOnly bool) error {
	if c.selected == name {
		return nil
	}
	_, err := c.conn.Select(name, readOnly)
	if err != nil {
		c.selected = ""
		return fmt.Errorf("select %q: %w", name, err)
	}
	c.selected = name
	return nil
}

// ListMessages returns up to limit envelopes from the given mailbox, newest first.
// If before > 0, only messages with UID < before are returned (cursor-style paging).
// The returned total is the mailbox's full message count (independent of the
// page), suitable for a "1–50 of N" pager.
func (c *Client) ListMessages(ctx context.Context, mailbox string, limit int, before uint32) ([]hmail.Envelope, uint32, error) {
	if limit <= 0 || limit > 200 {
		limit = 50
	}
	c.mu.Lock()
	defer c.mu.Unlock()
	if err := c.ensureLive(ctx); err != nil {
		return nil, 0, err
	}
	if err := c.selectMailbox(mailbox, true); err != nil {
		return nil, 0, err
	}
	mbox, err := c.conn.Select(mailbox, true)
	if err != nil {
		return nil, 0, err
	}
	total := mbox.Messages
	if total == 0 {
		return []hmail.Envelope{}, 0, nil
	}

	// Fetch the highest UID first; if before is set, cap the upper bound there.
	criteria := imap.NewSearchCriteria()
	if before > 0 {
		seq := new(imap.SeqSet)
		seq.AddRange(1, before-1)
		criteria.Uid = seq
	}
	uids, err := c.conn.UidSearch(criteria)
	if err != nil {
		return nil, 0, fmt.Errorf("uid search: %w", err)
	}
	if len(uids) == 0 {
		return []hmail.Envelope{}, total, nil
	}
	// Newest first; take the last `limit` UIDs.
	if len(uids) > limit {
		uids = uids[len(uids)-limit:]
	}
	seq := new(imap.SeqSet)
	seq.AddNum(uids...)

	msgs := make(chan *imap.Message, len(uids))
	fetchDone := make(chan error, 1)
	items := []imap.FetchItem{imap.FetchEnvelope, imap.FetchFlags, imap.FetchUid, imap.FetchBodyStructure}
	go func() { fetchDone <- c.conn.UidFetch(seq, items, msgs) }()

	var envelopes []hmail.Envelope
	for m := range msgs {
		envelopes = append(envelopes, envelopeFrom(m))
	}
	if err := <-fetchDone; err != nil {
		return nil, 0, fmt.Errorf("fetch envelopes: %w", err)
	}
	// Sort newest-first by UID descending.
	for i, j := 0, len(envelopes)-1; i < j; i, j = i+1, j-1 {
		envelopes[i], envelopes[j] = envelopes[j], envelopes[i]
	}
	return envelopes, total, nil
}

func envelopeFrom(m *imap.Message) hmail.Envelope {
	e := hmail.Envelope{
		UID:   m.Uid,
		Flags: append([]string(nil), m.Flags...),
	}
	if m.Envelope != nil {
		e.From = convertAddresses(m.Envelope.From)
		e.To = convertAddresses(m.Envelope.To)
		e.Cc = convertAddresses(m.Envelope.Cc)
		e.Subject = m.Envelope.Subject
		e.Date = m.Envelope.Date
	}
	if m.BodyStructure != nil {
		e.HasAttachments = bodyHasAttachments(m.BodyStructure)
	}
	return e
}

func convertAddresses(addrs []*imap.Address) []hmail.Address {
	out := make([]hmail.Address, 0, len(addrs))
	for _, a := range addrs {
		if a == nil {
			continue
		}
		var email string
		if a.MailboxName != "" && a.HostName != "" {
			email = a.MailboxName + "@" + a.HostName
		}
		out = append(out, hmail.Address{Name: a.PersonalName, Email: email})
	}
	return out
}

func bodyHasAttachments(bs *imap.BodyStructure) bool {
	if bs == nil {
		return false
	}
	if strings.EqualFold(bs.Disposition, "attachment") {
		return true
	}
	for _, p := range bs.Parts {
		if bodyHasAttachments(p) {
			return true
		}
	}
	return false
}

// GetMessage fetches the full message (text + html bodies, attachment metadata).
func (c *Client) GetMessage(ctx context.Context, mailbox string, uid uint32) (*hmail.Message, error) {
	c.mu.Lock()
	defer c.mu.Unlock()
	if err := c.ensureLive(ctx); err != nil {
		return nil, err
	}
	if err := c.selectMailbox(mailbox, true); err != nil {
		return nil, err
	}
	seq := new(imap.SeqSet)
	seq.AddNum(uid)
	section := &imap.BodySectionName{}
	items := []imap.FetchItem{imap.FetchEnvelope, imap.FetchFlags, imap.FetchUid, imap.FetchBodyStructure, section.FetchItem()}
	msgs := make(chan *imap.Message, 1)
	fetchDone := make(chan error, 1)
	go func() { fetchDone <- c.conn.UidFetch(seq, items, msgs) }()

	var raw *imap.Message
	for m := range msgs {
		raw = m
	}
	if err := <-fetchDone; err != nil {
		return nil, fmt.Errorf("fetch message: %w", err)
	}
	if raw == nil {
		return nil, ErrNotFound
	}
	body := raw.GetBody(section)
	if body == nil {
		return nil, ErrNotFound
	}
	parsed, err := parseRFC822(body)
	if err != nil {
		return nil, fmt.Errorf("parse rfc822: %w", err)
	}
	parsed.Envelope = envelopeFrom(raw)
	return parsed, nil
}

// ErrNotFound is returned when an operation cannot locate the requested item.
var ErrNotFound = errors.New("not found")

func parseRFC822(r io.Reader) (*hmail.Message, error) {
	mr, err := gomail.CreateReader(r)
	if err != nil {
		// Fall back to a single-part message.
		ent, err2 := message.Read(r)
		if err2 != nil {
			return nil, err
		}
		b, _ := io.ReadAll(ent.Body)
		return &hmail.Message{BodyText: string(b)}, nil
	}
	defer mr.Close()
	out := &hmail.Message{}

	if h := mr.Header; true {
		out.MessageID, _ = h.MessageID()
		if list, err := h.MsgIDList("In-Reply-To"); err == nil && len(list) > 0 {
			out.InReplyTo = list[0]
		}
		if list, err := h.MsgIDList("References"); err == nil {
			out.References = list
		}
	}

	for {
		p, err := mr.NextPart()
		if err == io.EOF {
			break
		}
		if err != nil {
			return nil, err
		}
		switch h := p.Header.(type) {
		case *gomail.InlineHeader:
			ct, _, _ := h.ContentType()
			b, _ := io.ReadAll(p.Body)
			switch strings.ToLower(ct) {
			case "text/html":
				out.BodyHTML = string(b)
			default:
				if out.BodyText == "" {
					out.BodyText = string(b)
				}
			}
		case *gomail.AttachmentHeader:
			ct, _, _ := h.ContentType()
			name, _ := h.Filename()
			data, _ := io.ReadAll(p.Body)
			out.Attachments = append(out.Attachments, hmail.AttachmentMeta{
				ID:       fmt.Sprintf("att-%d", len(out.Attachments)+1),
				Filename: name,
				MIMEType: ct,
				Size:     int64(len(data)),
			})
		}
	}
	return out, nil
}

// SetFlags adds or removes the given flags on a message.
func (c *Client) SetFlags(ctx context.Context, mailbox string, uid uint32, flags []string, add bool) error {
	c.mu.Lock()
	defer c.mu.Unlock()
	if err := c.ensureLive(ctx); err != nil {
		return err
	}
	if err := c.selectMailbox(mailbox, false); err != nil {
		return err
	}
	seq := new(imap.SeqSet)
	seq.AddNum(uid)
	op := imap.FlagsOp(imap.AddFlags)
	if !add {
		op = imap.FlagsOp(imap.RemoveFlags)
	}
	items := make([]any, 0, len(flags))
	for _, f := range flags {
		items = append(items, f)
	}
	return c.conn.UidStore(seq, imap.FormatFlagsOp(op, true), items, nil)
}

// Move moves the given message to the destination mailbox. Falls back to
// COPY+EXPUNGE if the server lacks MOVE.
func (c *Client) Move(ctx context.Context, mailbox string, uid uint32, dest string) error {
	c.mu.Lock()
	defer c.mu.Unlock()
	if err := c.ensureLive(ctx); err != nil {
		return err
	}
	if err := c.selectMailbox(mailbox, false); err != nil {
		return err
	}
	seq := new(imap.SeqSet)
	seq.AddNum(uid)
	if err := c.conn.UidMove(seq, dest); err == nil {
		return nil
	}
	// Fallback: COPY then mark deleted then EXPUNGE.
	if err := c.conn.UidCopy(seq, dest); err != nil {
		return fmt.Errorf("uid copy: %w", err)
	}
	if err := c.conn.UidStore(seq, imap.FormatFlagsOp(imap.AddFlags, true), []any{imap.DeletedFlag}, nil); err != nil {
		return fmt.Errorf("mark deleted: %w", err)
	}
	if err := c.conn.Expunge(nil); err != nil {
		return fmt.Errorf("expunge: %w", err)
	}
	return nil
}

func contextDeadline(ctx context.Context, fallback time.Duration) (time.Time, context.CancelFunc) {
	if d, ok := ctx.Deadline(); ok {
		return d, func() {}
	}
	return time.Now().Add(fallback), func() {}
}
