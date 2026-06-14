import React from "react";
import { Box, CircularProgress } from "@mui/material";
import { useNavigate } from "react-router-dom";
import ThreadListItem from "./ThreadListItem";
import EmptyState from "../atoms/EmptyState";

const ThreadList = ({
  threads,
  loading = false,
  emptyMessage = "No emails found",
  selectedThreadId,
}) => {
  const navigate = useNavigate();

  if (loading) {
    return (
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
    );
  }

  if (!threads || threads.length === 0) {
    return <EmptyState title={emptyMessage} />;
  }

  const handleThreadClick = (threadId) => {
    // Thread IDs are mailbox+uid composites and may contain slashes (e.g.
    // "[Gmail]/Sent Mail:807"). Encode so the route's `:threadId` matches a
    // single path segment; useParams() decodes it back automatically.
    navigate(`/thread/${encodeURIComponent(threadId)}`);
  };

  return (
    <Box sx={{ backgroundColor: "background.paper" }}>
      {threads.map((thread) => (
        <ThreadListItem
          key={thread.id}
          thread={thread}
          isSelected={thread.id === selectedThreadId}
          onClick={handleThreadClick}
        />
      ))}
    </Box>
  );
};

export default ThreadList;
