import { useMemo, useRef, useState } from "react";
import { Box } from "@mui/material";
import ComposeHeader from "./ComposeHeader";
import ComposeForm from "./ComposeForm";
import AttachmentList from "./AttachmentList";
import { useData } from "../../nonview/core/DataContext";
import type { RecipientInputHandle } from "./RecipientInput";
import type { Address } from "../../nonview/api/types";
import {
  defaultValues,
  getTemplate,
  type EmailTemplate,
  type TemplateValues,
} from "../../nonview/email/templates";
import { renderTemplate } from "../../nonview/email/renderTemplate";
import { plainTextToHtml } from "../../nonview/email/plainText";

type ComposeMode = "plaintext" | "template";

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

export interface QuotedOriginal {
  text: string;
  html: string;
}

// What was actually sent, handed back so a caller (e.g. ThreadPage) can show
// the message in the open conversation without a round-trip.
export interface SentSummary {
  content: string;
  contentHtml?: string;
  subject: string;
}

interface ComposePanelProps {
  initial?: ComposeInitial;
  threadContext?: ThreadContext;
  /** Original message to quote beneath the reply (formatting preserved). */
  quote?: QuotedOriginal;
  title?: string;
  sendLabel?: string;
  /** Called by the header's close button. */
  onClose: () => void;
  /** Called after a message is sent successfully, with what was sent. */
  onSent: (sent: SentSummary) => void;
  /** Called after a draft is saved; falls back to onSent if omitted. */
  onSavedDraft?: () => void;
}

// The full compose surface (header + form + attachments) with all of its state
// and send/draft logic. Rendered full-page by ComposePage and inside a modal by
// ComposeDialog, so replies and new messages share one implementation.
const ComposePanel = ({
  initial,
  threadContext,
  quote,
  title,
  sendLabel,
  onClose,
  onSent,
  onSavedDraft,
}: ComposePanelProps) => {
  const { contacts, sendEmail, saveDraft } = useData();

  const [recipients, setRecipients] = useState<Address[]>(initial?.to || []);
  const [subject, setSubject] = useState(initial?.subject || "");
  const [body, setBody] = useState(initial?.body || "");
  const [attachments, setAttachments] = useState<any[]>([]);

  // Template (react-email) composition state.
  const [mode, setMode] = useState<ComposeMode>("plaintext");
  const [templateId, setTemplateId] = useState<string | null>(null);
  const [templateValues, setTemplateValues] = useState<TemplateValues>({});

  const recipientInputRef = useRef<RecipientInputHandle | null>(null);
  const contactSuggestions = useMemo(() => contacts || [], [contacts]);

  const handleTemplateSelect = (template: EmailTemplate) => {
    setTemplateId(template.id);
    setTemplateValues(defaultValues(template));
    if (!subject.trim() && template.subject) {
      const suggested = template.subject(defaultValues(template));
      if (suggested) setSubject(suggested);
    }
  };

  const handleTemplateValueChange = (key: string, value: string) => {
    setTemplateValues((prev) => ({ ...prev, [key]: value }));
  };

  const handleChangeTemplate = () => setTemplateId(null);

  const handleAttachFiles = (files: File[]) => {
    const newAttachments = files.map((file) => ({
      id: `${file.name}-${file.size}-${file.lastModified}`,
      name: file.name,
      size: file.size,
      type: file.type,
      url: URL.createObjectURL(file),
    }));
    setAttachments((prev) => [...prev, ...newAttachments]);
  };

  const handleRemoveAttachment = (id: string) => {
    setAttachments((prev) => prev.filter((a) => a.id !== id));
  };

  // Assemble the outgoing bodies plus a display summary for the thread view.
  //   - textToSend / htmlToSend: what actually goes to the mail API
  //   - content / contentHtml: how the sent message should render in-thread
  // The quoted original (if replying) is appended to what the user wrote, with
  // its HTML preserved so a plain-text reply still quotes real HTML.
  const buildBody = async () => {
    if (mode === "template" && templateId) {
      const { html, text } = await renderTemplate(templateId, templateValues);
      return {
        textToSend: quote ? `${text}\n\n${quote.text}` : text,
        htmlToSend: html,
        content: text,
        contentHtml: html,
      };
    }
    const baseHtml = body.trim() ? plainTextToHtml(body) : "";
    return {
      textToSend: quote ? `${body}\n\n${quote.text}` : body,
      htmlToSend: quote ? baseHtml + quote.html : baseHtml || undefined,
      // Show just the user's own text as a chat bubble in the thread.
      content: body,
      contentHtml: undefined as string | undefined,
    };
  };

  const effectiveSubject = () => {
    if (subject.trim()) return subject;
    if (mode === "template" && templateId) {
      const t = getTemplate(templateId);
      return t?.subject?.(templateValues) || subject;
    }
    return subject;
  };

  const handleSend = async () => {
    const finalRecipients =
      recipientInputRef.current?.flushPending() ?? recipients;
    if (finalRecipients.length === 0) {
      throw new Error("Please enter at least one recipient");
    }
    const finalSubject = effectiveSubject();
    const built = await buildBody();
    await sendEmail({
      to: finalRecipients,
      subject: finalSubject,
      body: built.textToSend,
      bodyHtml: built.htmlToSend,
      attachments,
      inReplyTo: threadContext?.inReplyTo,
      references: threadContext?.references,
    });
    onSent({
      content: built.content,
      contentHtml: built.contentHtml,
      subject: finalSubject,
    });
  };

  const handleSaveDraft = async () => {
    const finalRecipients =
      recipientInputRef.current?.flushPending() ?? recipients;
    const finalSubject = effectiveSubject();
    const built = await buildBody();
    await saveDraft({
      to: finalRecipients,
      subject: finalSubject,
      body: built.textToSend,
      attachments,
    });
    (onSavedDraft || (() => onSent({ content: built.content, subject: finalSubject })))();
  };

  return (
    <Box sx={{ display: "flex", flexDirection: "column", minHeight: 0 }}>
      <ComposeHeader
        onSend={handleSend}
        onClose={onClose}
        title={title}
        sendLabel={sendLabel}
      />
      <Box sx={{ flex: 1, overflow: "auto" }}>
        <ComposeForm
          recipients={recipients}
          onRecipientsChange={setRecipients}
          recipientInputRef={recipientInputRef}
          subject={subject}
          onSubjectChange={setSubject}
          body={body}
          onBodyChange={setBody}
          onAttachFiles={handleAttachFiles}
          onSaveDraft={handleSaveDraft}
          onDiscard={onClose}
          contacts={contactSuggestions}
          mode={mode}
          onModeChange={setMode}
          templateId={templateId}
          templateValues={templateValues}
          onTemplateSelect={handleTemplateSelect}
          onTemplateValueChange={handleTemplateValueChange}
          onChangeTemplate={handleChangeTemplate}
        />
        <AttachmentList
          attachments={attachments}
          onRemove={handleRemoveAttachment}
          editable
        />
      </Box>
    </Box>
  );
};

export default ComposePanel;
