import React, { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { Box, CircularProgress, Alert } from "@mui/material";
import AppLayout from "../moles/AppLayout";
import ThreadHeader from "../moles/ThreadHeader";
import ThreadView from "../moles/ThreadView";
import MessageComposer from "../moles/MessageComposer";
import EmptyState from "../atoms/EmptyState";
import { useData } from "../../nonview/core/DataContext";

function ThreadPage() {
  const { threadId } = useParams();
  const {
    getThread,
    getMessages,
    getCachedMessages,
    sendMessage,
    markAsRead,
    loading,
  } = useData();

  const thread = threadId ? getThread(threadId) : undefined;

  const [messages, setMessages] = useState([]);
  const [messagesLoading, setMessagesLoading] = useState(false);
  const [messagesError, setMessagesError] = useState(null);

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

  const handleSendMessage = async (messageData) => {
    if (!threadId) return;
    await sendMessage(threadId, messageData.content);
  };

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
          />
        </Box>
        <Box
          sx={{
            borderTop: 1,
            borderColor: "divider",
            backgroundColor: "background.paper",
          }}
        >
          <MessageComposer threadId={threadId} onSend={handleSendMessage} />
        </Box>
      </Box>
    </AppLayout>
  );
}

export default ThreadPage;
