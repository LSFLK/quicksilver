// Package smtp wraps github.com/wneessen/go-mail with the small surface the
// Quicksilver API needs.
package smtp

import (
	"bytes"
	"context"
	"errors"
	"fmt"
	"strings"
	"time"

	mail "github.com/wneessen/go-mail"

	hmail "quicksilver/server/internal/mail"
)

// Sender opens a fresh authenticated SMTP session per Send call. SMTP
// connections are cheap relative to IMAP and short-lived sends sidestep
// connection-keepalive subtleties (TLS renegotiation, server timeouts).
type Sender struct {
	timeout time.Duration
}

// New returns a Sender configured with the supplied operation timeout.
func New(timeout time.Duration) *Sender {
	if timeout <= 0 {
		timeout = 30 * time.Second
	}
	return &Sender{timeout: timeout}
}

// Send delivers msg via the SMTP server described by creds.
func (s *Sender) Send(ctx context.Context, creds hmail.Credentials, msg hmail.OutgoingMessage) error {
	if creds.SMTPHost == "" {
		return errors.New("smtp host not configured")
	}
	if len(msg.To) == 0 {
		return errors.New("at least one recipient is required")
	}

	m := mail.NewMsg()

	from := msg.From
	if from.Email == "" {
		from.Email = creds.Email
	}
	if err := setFrom(m, from); err != nil {
		return fmt.Errorf("from: %w", err)
	}
	if err := addAll(m.AddTo, m.AddToFormat, msg.To); err != nil {
		return fmt.Errorf("to: %w", err)
	}
	if len(msg.Cc) > 0 {
		if err := addAll(m.AddCc, m.AddCcFormat, msg.Cc); err != nil {
			return fmt.Errorf("cc: %w", err)
		}
	}
	if len(msg.Bcc) > 0 {
		if err := addAll(m.AddBcc, m.AddBccFormat, msg.Bcc); err != nil {
			return fmt.Errorf("bcc: %w", err)
		}
	}
	m.Subject(msg.Subject)
	if msg.InReplyTo != "" {
		m.SetGenHeader(mail.HeaderInReplyTo, msg.InReplyTo)
	}
	if len(msg.References) > 0 {
		m.SetGenHeader(mail.HeaderReferences, strings.Join(msg.References, " "))
	}
	if msg.BodyText != "" {
		m.SetBodyString(mail.TypeTextPlain, msg.BodyText)
	}
	if msg.BodyHTML != "" {
		if msg.BodyText == "" {
			m.SetBodyString(mail.TypeTextHTML, msg.BodyHTML)
		} else {
			m.AddAlternativeString(mail.TypeTextHTML, msg.BodyHTML)
		}
	}
	for _, att := range msg.Attachments {
		opts := []mail.FileOption{}
		if att.MIMEType != "" {
			opts = append(opts, mail.WithFileContentType(mail.ContentType(att.MIMEType)))
		}
		if err := m.AttachReader(att.Filename, bytes.NewReader(att.Data), opts...); err != nil {
			return fmt.Errorf("attach %q: %w", att.Filename, err)
		}
	}

	opts := []mail.Option{
		mail.WithPort(creds.SMTPPort),
		mail.WithUsername(creds.Email),
		mail.WithPassword(creds.Password),
		mail.WithSMTPAuth(mail.SMTPAuthPlain),
		mail.WithTimeout(s.timeout),
	}
	if creds.SMTPSecure {
		// Implicit TLS (typically port 465). For STARTTLS on 587, leave
		// SMTPSecure=false; go-mail's default opportunistic TLS policy
		// will negotiate STARTTLS when offered.
		opts = append(opts, mail.WithSSL())
	} else {
		opts = append(opts, mail.WithTLSPolicy(mail.TLSOpportunistic))
	}

	c, err := mail.NewClient(creds.SMTPHost, opts...)
	if err != nil {
		return fmt.Errorf("smtp client: %w", err)
	}
	if err := c.DialAndSendWithContext(ctx, m); err != nil {
		return fmt.Errorf("smtp send: %w", err)
	}
	return nil
}

func setFrom(m *mail.Msg, a hmail.Address) error {
	if a.Email == "" {
		return errors.New("missing from address")
	}
	if a.Name != "" {
		return m.FromFormat(a.Name, a.Email)
	}
	return m.From(a.Email)
}

// addAll loops over a list of Addresses and dispatches each one to the right
// AddX or AddXFormat helper based on whether a display name is present.
func addAll(addPlain func(string) error, addFormatted func(string, string) error, addrs []hmail.Address) error {
	added := 0
	for _, a := range addrs {
		if a.Email == "" {
			continue
		}
		var err error
		if a.Name != "" {
			err = addFormatted(a.Name, a.Email)
		} else {
			err = addPlain(a.Email)
		}
		if err != nil {
			return err
		}
		added++
	}
	if added == 0 {
		return errors.New("no valid addresses")
	}
	return nil
}
