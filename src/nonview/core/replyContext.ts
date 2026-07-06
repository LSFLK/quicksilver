// Builds the prefilled compose state for replying / replying-all / forwarding
// from a thread and its loaded messages. Kept UI-agnostic so ThreadPage stays
// thin and the logic is testable.
//
// The reply editor starts empty; the original message is returned separately as
// a `quote` so its HTML formatting is preserved when the outgoing reply is
// assembled (a plain-text reply to an HTML mail still quotes the real HTML).

import type { Address } from "../api/types";
import type { Thread, ThreadMessage } from "./DataContext";
import { escapeHtml, plainTextToHtml } from "../email/plainText";

export type ReplyMode = "reply" | "replyAll" | "forward";

export interface ComposeInitial {
  to?: Address[];
  cc?: Address[];
  subject?: string;
  body?: string;
}

export interface ThreadContext {
  inReplyTo?: string;
  references?: string[];
}

// Pre-built text/HTML fragments for the quoted original, appended to whatever
// the user writes when the message is sent.
export interface QuotedOriginal {
  text: string;
  html: string;
}

export interface ReplyContext {
  initial: ComposeInitial;
  threadContext: ThreadContext;
  quote?: QuotedOriginal;
  title: string;
  sendLabel: string;
}

const stripPrefix = (subject: string, re: RegExp): string =>
  subject.replace(re, "").trim();

const withPrefix = (subject: string, prefix: "Re" | "Fwd"): string => {
  const base = stripPrefix(subject || "", /^\s*(re|fwd|fw)\s*:\s*/i);
  return `${prefix}: ${base || "(no subject)"}`;
};

// A real RFC Message-ID is used for threading; our fallback ids look like
// "msg-<uid>" and must not be sent as In-Reply-To.
const asMessageId = (id?: string): string | undefined =>
  id && !id.startsWith("msg-") && !id.startsWith("local-") ? id : undefined;

const fmtDate = (ts?: string): string =>
  ts ? new Date(ts).toLocaleString() : "";

const attributionStyle =
  'style="margin:16px 0 8px;color:#555;font-size:13px;"';
const quoteBoxStyle =
  'style="margin:0;padding:0 0 0 12px;border-left:3px solid #ccc;"';

// The quoted original for a reply: "On <date>, <who> wrote:" + the original.
const replyQuote = (msg: ThreadMessage): QuotedOriginal => {
  const who = msg.sender?.name || msg.sender?.email || "someone";
  const attribution = `On ${fmtDate(msg.timestamp)}, ${who} wrote:`;
  const text =
    attribution +
    "\n" +
    (msg.content || "")
      .split("\n")
      .map((l) => `> ${l}`)
      .join("\n");
  const html =
    `<p ${attributionStyle}>${escapeHtml(attribution)}</p>` +
    `<blockquote ${quoteBoxStyle}>${msg.contentHtml || plainTextToHtml(msg.content || "")}</blockquote>`;
  return { text, html };
};

// The quoted original for a forward: a header block + the original body.
const forwardQuote = (msg: ThreadMessage, subject: string): QuotedOriginal => {
  const from = `${msg.sender?.name || ""} <${msg.sender?.email || ""}>`.trim();
  const date = fmtDate(msg.timestamp);
  const header = [
    "---------- Forwarded message ----------",
    `From: ${from}`,
    `Date: ${date}`,
    `Subject: ${subject}`,
  ].join("\n");
  const text = `${header}\n\n${msg.content || ""}`;
  const html =
    `<p ${attributionStyle}>---------- Forwarded message ----------<br>` +
    `From: ${escapeHtml(from)}<br>Date: ${escapeHtml(date)}<br>` +
    `Subject: ${escapeHtml(subject)}</p>` +
    (msg.contentHtml || plainTextToHtml(msg.content || ""));
  return { text, html };
};

export function buildReplyContext(
  mode: ReplyMode,
  thread: Thread,
  messages: ThreadMessage[],
  currentUserEmail?: string,
): ReplyContext {
  const last = messages[messages.length - 1];
  const me = (currentUserEmail || "").toLowerCase();
  const senderEmail = last?.sender?.email || "";
  const messageId = asMessageId(last?.id);
  const threadContext: ThreadContext = messageId
    ? { inReplyTo: messageId, references: [messageId] }
    : {};

  if (mode === "forward") {
    return {
      initial: { to: [], subject: withPrefix(thread.subject, "Fwd"), body: "" },
      // A forward starts a new message; don't thread it onto the original.
      threadContext: {},
      quote: last ? forwardQuote(last, thread.subject) : undefined,
      title: "Forward message",
      sendLabel: "Send",
    };
  }

  const to: Address[] = senderEmail
    ? [{ email: senderEmail, name: last?.sender?.name }]
    : [];

  if (mode === "replyAll") {
    // No dedicated Cc field yet, so surface every other participant in the To
    // list — nothing is silently dropped and all recipients stay visible.
    const seen = new Set([senderEmail.toLowerCase(), me]);
    for (const p of thread.participants || []) {
      const email = (p.email || "").toLowerCase();
      if (email && !seen.has(email)) {
        seen.add(email);
        to.push({ email: p.email, name: p.name });
      }
    }
  }

  return {
    initial: { to, subject: withPrefix(thread.subject, "Re"), body: "" },
    threadContext,
    quote: last ? replyQuote(last) : undefined,
    title: mode === "replyAll" ? "Reply all" : "Reply",
    sendLabel: "Send",
  };
}
