// Strips the quoted-original chain from a reply's HTML body so the chat
// bubble shows only the newly written content — the WhatsApp model where the
// original appears as a compact quoted preview instead (issue #43).
//
// Only KNOWN reply-quote containers are removed (Gmail, Apple Mail, Outlook,
// and this app's own composer, see replyContext.ts). Anything unrecognised is
// left untouched, so the worst case is today's behaviour. Callers must only
// invoke this for messages that are replies (In-Reply-To present) — forwards
// keep their quoted content, which *is* the message.
//
// Parsing happens in an inert DOMParser document (no script execution, no
// resource loading); DOMPurify sanitisation still runs downstream in
// MessageContent before anything is rendered.
export function stripQuotedHtml(html: string): string {
  if (!html || typeof DOMParser === "undefined") return html;

  let doc: Document;
  try {
    doc = new DOMParser().parseFromString(html, "text/html");
  } catch {
    return html;
  }
  const body = doc.body;
  if (!body) return html;

  const removals = new Set<Element>();

  // Gmail wraps attribution + original in a dedicated container.
  body
    .querySelectorAll(".gmail_quote, .gmail_quote_container")
    .forEach((el) => removals.add(el));

  // Apple Mail (and other standards-ish clients) cite with a typed blockquote.
  body
    .querySelectorAll('blockquote[type="cite"]')
    .forEach((el) => removals.add(el));

  // Outlook inserts a reply header div; the original message is everything
  // after it (usually preceded by an <hr> separator).
  const outlook = body.querySelector("#divRplyFwdMsg, #appendonsend");
  if (outlook && outlook.parentNode) {
    const prev = outlook.previousElementSibling;
    if (prev && prev.tagName === "HR") removals.add(prev);
    let node: Element | null = outlook;
    while (node) {
      removals.add(node);
      node = node.nextElementSibling;
    }
  }

  // This app's composer: an "On <date>, <who> wrote:" attribution paragraph
  // immediately followed by a blockquote (replyContext.ts).
  body.querySelectorAll("blockquote").forEach((bq) => {
    const prev = bq.previousElementSibling;
    if (prev && /^On .+ wrote:\s*$/.test((prev.textContent || "").trim())) {
      removals.add(prev);
      removals.add(bq);
    }
  });

  if (removals.size === 0) return html;
  removals.forEach((el) => el.remove());

  // Never blank a message: if stripping removed all visible content (e.g. a
  // quote-only reply), fall back to the original body.
  const remainingText = (body.textContent || "").trim();
  const remainingMedia = body.querySelector("img, table");
  if (!remainingText && !remainingMedia) return html;

  return body.innerHTML;
}
