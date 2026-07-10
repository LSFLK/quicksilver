import { lazy, Suspense, useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import { Box, CircularProgress, Alert, Snackbar } from "@mui/material";
import ThreadHeader from "../moles/ThreadHeader";
import ThreadView from "../moles/ThreadView";
import ReplyBar from "../moles/ReplyBar";
import EmptyState from "../atoms/EmptyState";

// Reply/forward reuses the compose interface, which pulls in react-email. Keep
// it out of the main bundle — only load it when the user opens a reply popup.
const ComposeDialog = lazy(() => import("../moles/ComposeDialog"));
import { useData } from "../../nonview/core/DataContext";
import { useAccount } from "../../nonview/core/AccountContext";
import { buildReplyContext, type ReplyMode } from "../../nonview/core/replyContext";
import { plainTextToHtml } from "../../nonview/email/plainText";

function ThreadPage() {
  const { threadId } = useParams();
  const {
    getThread,
    getMessages,
    getCachedMessages,
    markAsRead,
    downloadAttachment,
    fetchAttachment,
    sendEmail,
    loading,
  } = useData();
  const { activeAccount } = useAccount();

  const thread = threadId ? getThread(threadId) : undefined;

  const [messages, setMessages] = useState([]);
  const [messagesLoading, setMessagesLoading] = useState(false);
  const [messagesError, setMessagesError] = useState(null);

  // Inline quick-reply draft, typed straight into the reply bar.
  const [draftText, setDraftText] = useState("");
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState(null);

  // Reply/forward compose popup state — only opened via the reply bar's pen
  // icon (customize) or the Reply all / Forward actions.
  const [replyMode, setReplyMode] = useState<ReplyMode | null>(null);
  const [sentToast, setSentToast] = useState(false);

  const replyCtx = useMemo(() => {
    if (!replyMode || !thread) return null;
    const ctx = buildReplyContext(replyMode, thread, messages, activeAccount?.email);
    // Carry over whatever the user already typed inline into the popup.
    if (replyMode === "reply" && draftText.trim()) {
      return { ...ctx, initial: { ...ctx.initial, body: draftText } };
    }
    return ctx;
  }, [replyMode, thread, messages, activeAccount, draftText]);

  const appendLocalMessage = (content: string, contentHtml?: string) => {
    setMessages((prev) => [
      ...prev,
      {
        id: `local-${Date.now()}`,
        content,
        contentHtml,
        sender: {
          id: "current",
          name: activeAccount?.name || "You",
          email: activeAccount?.email || "",
        },
        timestamp: new Date().toISOString(),
        isRead: true,
      },
    ]);
  };

  // Sends the inline draft as a plain-text reply to the thread's last sender,
  // without opening the compose popup.
  const handleQuickSend = async () => {
    if (!thread || !draftText.trim() || sending) return;
    const ctx = buildReplyContext("reply", thread, messages, activeAccount?.email);
    const text = draftText.trim();
    const html = plainTextToHtml(text);
    setSending(true);
    setSendError(null);
    try {
      await sendEmail({
        to: ctx.initial.to,
        subject: ctx.initial.subject,
        body: ctx.quote ? `${text}\n\n${ctx.quote.text}` : text,
        bodyHtml: ctx.quote ? html + ctx.quote.html : html,
        inReplyTo: ctx.threadContext.inReplyTo,
        references: ctx.threadContext.references,
      });
      appendLocalMessage(text);
      setDraftText("");
      setSentToast(true);
    } catch (e) {
      setSendError(e?.message || "Failed to send reply");
    } finally {
      setSending(false);
    }
  };

  // Fetch the message body once per thread. `getMessages` is memoized in
  // DataContext (deps: [apiClient]), so this effect only re-runs when the
  // route changes.
  useEffect(() => {
    if (!threadId) return;
    let cancelled = false;
    let paintedFromCache = false;
    setMessagesError(null);

    // Cache-first: paint the cached body immediately (no spinner), then
    // revalidate from the network in the background. On a cold thread we show
    // the spinner until the network fetch lands.
    getCachedMessages(threadId).then((cached) => {
      if (cancelled || !cached) return;
      paintedFromCache = true;
      setMessages(cached);
      setMessagesLoading(false);
    });
    setMessagesLoading(true);

    getMessages(threadId)
      .then((m) => {
        if (!cancelled) setMessages(m);
      })
      .catch((e) => {
        // A revalidation failure shouldn't blank out a body we already painted
        // from cache; only surface the error when we have nothing to show.
        if (!cancelled && !paintedFromCache) {
          setMessagesError(e?.message || "Failed to load message");
        }
      })
      .finally(() => {
        if (!cancelled) setMessagesLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [threadId, getMessages, getCachedMessages]);

  // Mark the thread as read once we know it exists. Best-effort — surface
  // failures only in the console so a flag-update glitch doesn't break the read view.
  useEffect(() => {
    if (!threadId || !thread || thread.unreadCount === 0) return;
    markAsRead(threadId).catch((e) =>
      console.warn("markAsRead failed", e),
    );
  }, [threadId, thread, markAsRead]);

  if (loading && !thread) {
    return (
      <Box
        sx={{
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          p: 3,
          height: "100%",
        }}
      >
        <CircularProgress />
      </Box>
    );
  }

  if (!thread) {
    return (
      <EmptyState
        title="Thread not found"
        description="The requested thread does not exist."
      />
    );
  }

  return (
    <Box
      sx={{
        display: "flex",
        flexDirection: "column",
        height: "100%",
        overflow: "hidden",
      }}
    >
      <ThreadHeader thread={thread} onForward={() => setReplyMode("forward")} />
      <Box sx={{ flex: 1, overflow: "auto" }}>
        {messagesError && (
          <Alert severity="error" sx={{ m: 2 }}>
            {messagesError}
          </Alert>
        )}
        {sendError && (
          <Alert severity="error" sx={{ m: 2 }} onClose={() => setSendError(null)}>
            {sendError}
          </Alert>
        )}
        <ThreadView
          thread={thread}
          messages={messages}
          loading={messagesLoading}
          onDownloadAttachment={(sourceThreadId, attachmentId, filename) =>
            downloadAttachment(sourceThreadId || threadId, attachmentId, filename)
          }
          onFetchAttachment={(sourceThreadId, attachmentId) =>
            fetchAttachment(sourceThreadId || threadId, attachmentId)
          }
        />
      </Box>
      <ReplyBar
        canReplyAll={(thread.participants || []).length > 1}
        value={draftText}
        onChange={setDraftText}
        onSend={handleQuickSend}
        sending={sending}
        onCustomize={() => setReplyMode("reply")}
        onReplyAll={() => setReplyMode("replyAll")}
      />

      {replyCtx && (
        <Suspense fallback={null}>
          <ComposeDialog
            open
            onClose={() => setReplyMode(null)}
            onSent={(sent) => {
              setReplyMode(null);
              setSentToast(true);
              setDraftText("");
              // Optimistically show the sent reply in the open conversation.
              // The real copy lives in the Sent mailbox, so a refetch of this
              // thread wouldn't surface it; append it locally instead.
              appendLocalMessage(sent.content || "", sent.contentHtml);
            }}
            initial={replyCtx.initial}
            threadContext={replyCtx.threadContext}
            quote={replyCtx.quote}
            title={replyCtx.title}
            sendLabel={replyCtx.sendLabel}
          />
        </Suspense>
      )}

      <Snackbar
        open={sentToast}
        autoHideDuration={4000}
        onClose={() => setSentToast(false)}
        anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
        message="Message sent"
      />
    </Box>
  );
}

export default ThreadPage;
