// Shared TypeScript types mirroring the Go DTOs in server/internal/mail/types.go.
// Keep field names in sync with the JSON tags on the server side.

export interface Address {
  name?: string;
  email: string;
}

export interface Mailbox {
  name: string;
  delimiter?: string;
  flags?: string[];
  role?: "inbox" | "sent" | "drafts" | "trash" | "junk" | "archive" | "";
}

export interface Envelope {
  uid: number;
  from: Address[];
  to: Address[];
  cc?: Address[];
  subject: string;
  date: string; // ISO 8601
  flags: string[];
  has_attachments: boolean;
  preview?: string;
}

export interface AttachmentMeta {
  id: string;
  filename: string;
  mime_type: string;
  size: number;
}

export interface Message extends Envelope {
  body_text?: string;
  body_html?: string;
  attachments?: AttachmentMeta[];
  in_reply_to?: string;
  references?: string[];
  message_id?: string;
}

export interface OutgoingMessage {
  to: Address[];
  cc?: Address[];
  bcc?: Address[];
  subject: string;
  body_text?: string;
  body_html?: string;
  in_reply_to?: string;
  references?: string[];
}

export interface LoginRequest {
  email: string;
  password: string;
  imap_host: string;
  imap_port: number;
  imap_secure: boolean;
  smtp_host: string;
  smtp_port: number;
  smtp_secure: boolean;
}

export interface LoginResponse {
  token: string;
  expires_at: string;
  subject: string;
  session_id: string;
}

export interface MailboxListResponse {
  mailboxes: Mailbox[];
}

export interface MessageListResponse {
  messages: Envelope[];
  next_before?: number;
  // Total messages in the mailbox (independent of the page), for "1–50 of N".
  total?: number;
  // The mailbox's UIDVALIDITY, persisted so a later delta sync can detect a
  // cache-invalidating change upstream.
  uidvalidity?: number;
}

// FlagUpdate is the current flag set for one known message (see MailboxDelta).
export interface FlagUpdate {
  uid: number;
  flags: string[];
}

// MailboxDelta is the incremental-sync payload from GET .../changes. Mirrors
// server/internal/mail/types.go MailboxDelta. `added` are full envelopes for
// genuinely-new messages; `flags` are current flags for known messages still
// present (the client diffs them); `removed` are known UIDs now gone. When
// `resync` is true the client must discard its cache and refetch the folder.
export interface MailboxDelta {
  uidvalidity: number;
  total: number;
  resync: boolean;
  added: Envelope[] | null;
  flags: FlagUpdate[] | null;
  removed: number[] | null;
}

export interface APIErrorBody {
  code: string;
  error: string;
}
