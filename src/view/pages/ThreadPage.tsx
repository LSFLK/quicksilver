import { lazy, Suspense, useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import { Box, CircularProgress, Alert, Snackbar } from "@mui/material";
import AppLayout from "../moles/AppLayout";
import ThreadHeader from "../moles/ThreadHeader";
import ThreadView from "../moles/ThreadView";
import ReplyBar from "../moles/ReplyBar";
import EmptyState from "../atoms/EmptyState";

// Reply/forward reuses the compose interface, which pulls in react-email. Keep
// it out of the main bundle — only load it when the user opens a reply popup.
const ComposeDialog = lazy(() => import("../moles/ComposeDialog"));
import { useData } from "../../nonview/core/DataContext";
import { useAuth } from "../../nonview/core/AuthContext";
import { buildReplyContext, type ReplyMode } from "../../nonview/core/replyContext";

function ThreadPage() {
  const { threadId } = useParams();
  const {
    getThread,
    getMessages,
    getCachedMessages,
    markAsRead,
    downloadAttachment,
    fetchAttachment,
    loading,
  } = useData();
  const { currentUser } = useAuth();

  const thread = threadId ? getThread(threadId) : undefined;

  const [messages, setMessages] = useState([]);
  const [messagesLoading, setMessagesLoading] = useState(false);
  const [messagesError, setMessagesError] = useState(null);

  // Reply/forward compose popup state.
  const [replyMode, setReplyMode] = useState<ReplyMode | null>(null);
  const [sentToast, setSentToast] = useState(false);

  const replyCtx = useMemo(() => {
    if (!replyMode || !thread) return null;
    return buildReplyContext(replyMode, thread, messages, currentUser?.email);
  }, [replyMode, thread, messages, currentUser]);

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
      <AppLayout title="Thread">
        <Box
          sx={{
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            p: 3,
          }}
        >
          <CircularProgress />
        </Box>
      </AppLayout>
    );
  }

  if (!thread) {
    return (
      <AppLayout title="Thread">
        <EmptyState
          title="Thread not found"
          description="The requested thread does not exist."
        />
      </AppLayout>
    );
  }

  return (
    <AppLayout title={thread.subject || "Thread"}>
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
          <ThreadView
            thread={thread}
            messages={messages}
            loading={messagesLoading}
            onDownloadAttachment={(attachmentId, filename) =>
              downloadAttachment(threadId, attachmentId, filename)
            }
            onFetchAttachment={(attachmentId) =>
              fetchAttachment(threadId, attachmentId)
            }
          />
        </Box>
        <ReplyBar
          canReplyAll={(thread.participants || []).length > 1}
          onReply={() => setReplyMode("reply")}
          onReplyAll={() => setReplyMode("replyAll")}
          onForward={() => setReplyMode("forward")}
        />
      </Box>

      {replyCtx && (
        <Suspense fallback={null}>
          <ComposeDialog
            open
            onClose={() => setReplyMode(null)}
            onSent={(sent) => {
              setReplyMode(null);
              setSentToast(true);
              // Optimistically show the sent reply in the open conversation.
              // The real copy lives in the Sent mailbox, so a refetch of this
              // thread wouldn't surface it; append it locally instead.
              setMessages((prev) => [
                ...prev,
                {
                  id: `local-${Date.now()}`,
                  content: sent.content || "",
                  contentHtml: sent.contentHtml,
                  sender: {
                    id: "current",
                    name: currentUser?.name || "You",
                    email: currentUser?.email || "",
                  },
                  timestamp: new Date().toISOString(),
                  isRead: true,
                },
              ]);
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
    </AppLayout>
  );
}

export default ThreadPage;
