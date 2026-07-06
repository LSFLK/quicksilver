// Helpers for turning plain-text compose input into a formatted HTML email part.
// Used so a plain-text reply still arrives properly formatted (paragraphs and
// blank lines preserved), and so a quoted original keeps its structure.

const FONT =
  'font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Helvetica,Arial,sans-serif;' +
  "font-size:15px;line-height:1.6;color:#1a1a1a;";

export function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

// Converts plain text to a styled HTML fragment. Consecutive lines starting
// with ">" become a blockquote; everything else is emitted with the original
// whitespace preserved (white-space: pre-wrap), so line breaks survive.
export function plainTextToHtml(text: string): string {
  if (!text) return "";
  const lines = text.split("\n");
  let html = "";
  let i = 0;
  while (i < lines.length) {
    if (lines[i].startsWith(">")) {
      const q: string[] = [];
      while (i < lines.length && lines[i].startsWith(">")) {
        q.push(lines[i].replace(/^>\s?/, ""));
        i++;
      }
      html +=
        '<blockquote style="margin:0 0 8px;padding:2px 0 2px 12px;' +
        'border-left:3px solid #ccc;color:#555;white-space:pre-wrap;">' +
        escapeHtml(q.join("\n")) +
        "</blockquote>";
    } else {
      const p: string[] = [];
      while (i < lines.length && !lines[i].startsWith(">")) {
        p.push(lines[i]);
        i++;
      }
      html +=
        '<div style="white-space:pre-wrap;margin:0 0 8px;">' +
        escapeHtml(p.join("\n")) +
        "</div>";
    }
  }
  return `<div style="${FONT}">${html}</div>`;
}
