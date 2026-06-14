// Package mail defines shared DTOs used by the IMAP/SMTP layers and the HTTP
// handlers. Keeping these types in one neutral package avoids both directions
// of leakage between transport and protocol code.
package mail

import "time"

// Credentials captures everything the server needs to connect to a user's
// upstream IMAP/SMTP provider on their behalf. SMTP credentials default to the
// same username/password as IMAP unless the SMTP* fields override them.
type Credentials struct {
	Email      string `json:"email"`
	Password   string `json:"password"`
	IMAPHost   string `json:"imap_host"`
	IMAPPort   int    `json:"imap_port"`
	IMAPSecure bool   `json:"imap_secure"`
	SMTPHost   string `json:"smtp_host"`
	SMTPPort   int    `json:"smtp_port"`
	SMTPSecure bool   `json:"smtp_secure"`
}

// Address is a person/email pair from RFC 5322 envelope fields.
type Address struct {
	Name  string `json:"name,omitempty"`
	Email string `json:"email"`
}

// Mailbox is a server-side folder.
type Mailbox struct {
	Name      string   `json:"name"`
	Delimiter string   `json:"delimiter,omitempty"`
	Flags     []string `json:"flags,omitempty"`
	// Role is a normalised role hint (inbox, sent, drafts, trash, ...) inferred
	// from special-use flags. Empty if unknown.
	Role string `json:"role,omitempty"`
}

// Envelope is the lightweight summary used in list views.
type Envelope struct {
	UID            uint32    `json:"uid"`
	From           []Address `json:"from"`
	To             []Address `json:"to"`
	Cc             []Address `json:"cc,omitempty"`
	Subject        string    `json:"subject"`
	Date           time.Time `json:"date"`
	Flags          []string  `json:"flags"`
	HasAttachments bool      `json:"has_attachments"`
	Preview        string    `json:"preview,omitempty"`
}

// AttachmentMeta describes an attachment without including its bytes.
type AttachmentMeta struct {
	ID       string `json:"id"`
	Filename string `json:"filename"`
	MIMEType string `json:"mime_type"`
	Size     int64  `json:"size"`
}

// Message is the full body+metadata view of a single mail item.
type Message struct {
	Envelope
	BodyText    string           `json:"body_text,omitempty"`
	BodyHTML    string           `json:"body_html,omitempty"`
	Attachments []AttachmentMeta `json:"attachments,omitempty"`
	InReplyTo   string           `json:"in_reply_to,omitempty"`
	References  []string         `json:"references,omitempty"`
	MessageID   string           `json:"message_id,omitempty"`
}

// OutgoingMessage is the input to SMTP send.
type OutgoingMessage struct {
	From        Address              `json:"from"`
	To          []Address            `json:"to"`
	Cc          []Address            `json:"cc,omitempty"`
	Bcc         []Address            `json:"bcc,omitempty"`
	Subject     string               `json:"subject"`
	BodyText    string               `json:"body_text,omitempty"`
	BodyHTML    string               `json:"body_html,omitempty"`
	InReplyTo   string               `json:"in_reply_to,omitempty"`
	References  []string             `json:"references,omitempty"`
	Attachments []OutgoingAttachment `json:"attachments,omitempty"`
}

// OutgoingAttachment carries an in-memory attachment for send.
type OutgoingAttachment struct {
	Filename string
	MIMEType string
	Data     []byte
}
