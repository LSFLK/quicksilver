import { lazy, Suspense, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Box, CircularProgress, Alert, Snackbar } from "@mui/material";
import ThreadHeader from "../moles/ThreadHeader";
import ThreadView from "../moles/ThreadView";
import ReplyBar from "../moles/ReplyBar";
import EmptyState from "../atoms/EmptyState";

// Reply/forward reuses the compose interface, which pulls in react-email. Keep
// it out of the main bundle — only load it when the user opens a reply popup.
const ComposeDialog = lazy(() => import("../moles/ComposeDialog"));
import { useData, type ThreadMessage } from "../../nonview/core/DataContext";
import { useAccount } from "../../nonview/core/AccountContext";
import { buildReplyContext, type ReplyMode } from "../../nonview/core/replyContext";
import { plainTextToHtml } from "../../nonview/email/plainText";

function ThreadPage() {
  const { threadId } = useParams();
  const navigate = useNavigate();
  const {
    getThread,
    getMessages,
    getCachedMessages,
    markAsRead,
    markAsUnread,
    deleteThread,
    archiveThread,
    restoreMessage,
    deleteMessagePermanently,
    downloadAttachment,
    fetchAttachment,
    sendEmail,
    loading,
  } = useData();
  const { activeAccount } = useAccount();

  // Hold on to the last live thread: when every message of a conversation is
  // moved to Trash the grouped thread disappears from the lists, but the page
  // must keep rendering so the trashed messages can be restored or purged.
  const liveThread = threadId ? getThread(threadId) : undefined;
  const [heldThread, setHeldThread] = useState(liveThread);
  useEffect(() => {
    setHeldThread(undefined);
  }, [threadId]);
  useEffect(() => {
    if (liveThread) setHeldThread(liveThread);
  }, [liveThread]);
  const thread = liveThread || heldThread;

  const [messages, setMessages] = useState([]);
  // Messages moved to Trash but kept visible in an "In Trash" state. Held
  // separately from `messages` so conversation refetches (which no longer
  // include them) don't wipe them.
  const [deletedMessages, setDeletedMessages] = useState<ThreadMessage[]>([]);
  const [messagesLoading, setMessagesLoading] = useState(false);
  const [messagesError, setMessagesError] = useState(null);

  // Inline quick-reply draft, typed straight into the reply bar.
  const [draftText, setDraftText] = useState("");
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState(null);

  // Reply/forward compose popup state — opened via the reply bar's pen icon
  // (customize), Reply all, or a message's context/kebab menu.
  const [replyMode, setReplyMode] = useState<ReplyMode | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  // After the user explicitly marks a message unread, don't let the auto
  // mark-as-read effect immediately flip it back while they stay on the
  // thread. Reset when they navigate to a different thread.
  const suppressAutoRead = useRef(false);
  useEffect(() => {
    suppressAutoRead.current = false;
    setDeletedMessages([]);
  }, [threadId]);

  const replyCtx = useMemo(() => {
    if (!replyMode || !thread) return null;
    const ctx = buildReplyContext(replyMode, thread, messages, activeAccount?.email);
    // Carry over whatever the user already typed inline into the popup.
    if (replyMode === "reply" && draftText.trim()) {
      return { ...ctx, initial: { ...ctx.initial, body: draftText } };
    }
    return ctx;
  }, [replyMode, thread, messages, activeAccount, draftText]);

  const appendLocalMessage = (content: string, contentHtml?: string, inReplyTo?: string) => {
    setMessages((prev) => [
      ...prev,
      {
        id: `local-${Date.now()}`,
        content,
        contentHtml,
        inReplyTo,
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
      appendLocalMessage(text, undefined, ctx.threadContext.inReplyTo);
      setDraftText("");
      setToast("Message sent");
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
    // The user just marked a message unread on purpose; leave it that way.
    if (suppressAutoRead.current) return;
    markAsRead(threadId).catch((e) =>
      console.warn("markAsRead failed", e),
    );
  }, [threadId, thread, markAsRead]);

  // Per-message actions from the bubble's kebab / right-click menu (issue #40).
  const handleMessageAction = async (action: string, message: ThreadMessage) => {
    const srcId = message.sourceThreadId;
    setActionError(null);
    try {
      switch (action) {
        case "reply":
          setReplyMode("reply");
          break;
        case "replyAll":
          setReplyMode("replyAll");
          break;
        case "forward":
          setReplyMode("forward");
          break;
        case "copy":
          await navigator.clipboard.writeText(message.content || "");
          setToast("Copied to clipboard");
          break;
        case "unread":
          if (!srcId) return;
          suppressAutoRead.current = true;
          await markAsUnread(srcId);
          setToast("Marked as unread");
          break;
        case "archive": {
          if (!srcId) return;
          await archiveThread(srcId);
          const next = messages.filter((m) => m.sourceThreadId !== srcId);
          setMessages(next);
          setToast("Message archived");
          if (next.length === 0 && deletedMessages.length === 0) {
            navigate("/", { replace: true });
          }
          break;
        }
        case "delete": {
          // Server-side the message moves to Trash and both folders re-sync;
          // the conversation (and its list row) stay visible with the message
          // in an "In Trash" state. Mark the in-memory copy immediately for
          // instant feedback, and keep a fallback copy in deletedMessages to
          // bridge the moment between the folder syncs and the refetch.
          if (!srcId) return;
          await deleteThread(srcId);
          setMessages((prev) =>
            prev.map((m) => (m.id === message.id ? { ...m, deleted: true } : m)),
          );
          setDeletedMessages((prev) =>
            prev.some((m) => m.id === message.id)
              ? prev
              : [...prev, { ...message, deleted: true }],
          );
          setToast("Message moved to Trash");
          break;
        }
        case "restore": {
          await restoreMessage(message.id);
          // The restore re-syncs inbox and trash; the message rejoins the
          // fetched conversation (under its new UID) via the normal refetch
          // path. Unmark the in-memory copy for instant feedback.
          setDeletedMessages((prev) => prev.filter((m) => m.id !== message.id));
          setMessages((prev) =>
            prev.map((m) => (m.id === message.id ? { ...m, deleted: false } : m)),
          );
          setToast("Message restored to Inbox");
          break;
        }
        case "deletePermanent": {
          if (!window.confirm("Permanently delete this message? This cannot be undone.")) {
            return;
          }
          await deleteMessagePermanently(message.id);
          const remainingDeleted = deletedMessages.filter((m) => m.id !== message.id);
          const remainingFetched = messages.filter((m) => m.id !== message.id);
          setDeletedMessages(remainingDeleted);
          setMessages(remainingFetched);
          setToast("Message permanently deleted");
          if (remainingFetched.length === 0 && remainingDeleted.length === 0) {
            navigate("/", { replace: true });
          }
          break;
        }
      }
    } catch (e) {
      setActionError((e as Error)?.message || "Action failed");
    }
  };

  // Fetched messages plus locally-held "In Trash" fallbacks, oldest-first.
  // Fetched copies win: once a refetch returns the message from its new home
  // (Trash source → deleted flag, or inbox again after a restore) that state
  // is the truth; the local copy only bridges the sync gap.
  const displayMessages = useMemo(() => {
    const fetchedIds = new Set(messages.map((m) => m.id));
    return [
      ...messages,
      ...deletedMessages.filter((m) => !fetchedIds.has(m.id)),
    ].sort(
      (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime(),
    );
  }, [messages, deletedMessages]);

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
      <ThreadHeader thread={thread} />
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
        {actionError && (
          <Alert severity="error" sx={{ m: 2 }} onClose={() => setActionError(null)}>
            {actionError}
          </Alert>
        )}
        <ThreadView
          thread={thread}
          messages={displayMessages}
          loading={messagesLoading}
          onDownloadAttachment={(sourceThreadId, attachmentId, filename) =>
            downloadAttachment(sourceThreadId || threadId, attachmentId, filename)
          }
          onFetchAttachment={(sourceThreadId, attachmentId) =>
            fetchAttachment(sourceThreadId || threadId, attachmentId)
          }
          onMessageAction={handleMessageAction}
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
              setToast("Message sent");
              setDraftText("");
              // Optimistically show the sent reply in the open conversation.
              // The real copy lives in the Sent mailbox, so a refetch of this
              // thread wouldn't surface it; append it locally instead.
              appendLocalMessage(
                sent.content || "",
                sent.contentHtml,
                replyCtx.threadContext.inReplyTo,
              );
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
        open={!!toast}
        autoHideDuration={4000}
        onClose={() => setToast(null)}
        anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
        message={toast}
      />
    </Box>
  );
}

export default ThreadPage;
