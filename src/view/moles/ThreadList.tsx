import React, { useEffect, useRef, useState } from "react";
import { Box, CircularProgress, IconButton, Typography } from "@mui/material";
import ChevronLeftIcon from "@mui/icons-material/ChevronLeft";
import ChevronRightIcon from "@mui/icons-material/ChevronRight";
import RefreshIcon from "@mui/icons-material/Refresh";
import { useNavigate } from "react-router-dom";
import { useVirtualizer } from "@tanstack/react-virtual";
import ThreadListItem from "./ThreadListItem";
import EmptyState from "../atoms/EmptyState";

// Approximate height of one ThreadListItem (avatar + three text rows + padding).
// react-virtual uses this only for the initial layout estimate; real heights
// are measured per row via measureElement, so variable-height items are fine.
const ESTIMATED_ROW_HEIGHT = 92;

const ThreadList = ({
  threads,
  loading = false,
  emptyMessage = "No emails found",
  selectedThreadId = null,
  // Gmail-style pager. When onNext/onPrev are provided and total > 0, a
  // "start–end of total" bar with prev/next arrows is shown above the list.
  page = 0,
  total = 0,
  pageSize = 50,
  onNext = undefined,
  onPrev = undefined,
  pageLoading = false,
  // Optional delta-sync trigger. When provided, a refresh button is shown in the
  // pager bar; it fetches only what changed since the last sync (proposal §6).
  onRefresh = undefined,
}) => {
  const navigate = useNavigate();
  const parentRef = useRef(null);
  const [refreshing, setRefreshing] = useState(false);

  const handleRefresh = async () => {
    if (!onRefresh || refreshing) return;
    setRefreshing(true);
    try {
      await onRefresh();
    } finally {
      setRefreshing(false);
    }
  };

  // Jump back to the top of the list whenever the page changes, so a new page
  // starts at its first message rather than wherever the previous one scrolled.
  useEffect(() => {
    if (parentRef.current) parentRef.current.scrollTop = 0;
  }, [page]);

  const rowVirtualizer = useVirtualizer({
    count: threads?.length || 0,
    getScrollElement: () => parentRef.current,
    estimateSize: () => ESTIMATED_ROW_HEIGHT,
    // Render a few extra rows above/below the viewport so fast scrolling
    // doesn't flash blank space.
    overscan: 8,
  });

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

  const items = rowVirtualizer.getVirtualItems();

  // Pager math. start/end are 1-based and reflect the rows actually shown.
  const showPager = !!(onNext || onPrev) && total > 0;
  // The top bar appears for the pager and/or the refresh button.
  const showBar = showPager || !!onRefresh;
  const start = page * pageSize + 1;
  const end = page * pageSize + threads.length;
  const canPrev = page > 0 && !pageLoading;
  const canNext = end < total && !pageLoading;

  return (
    <Box
      sx={{
        height: "100%",
        display: "flex",
        flexDirection: "column",
        backgroundColor: "background.paper",
      }}
    >
      {showBar && (
        <Box
          sx={{
            display: "flex",
            alignItems: "center",
            justifyContent: "flex-end",
            gap: 1,
            px: 2,
            py: 0.5,
            borderBottom: 1,
            borderColor: "divider",
            minHeight: 44,
          }}
        >
          {onRefresh && (
            <IconButton
              size="small"
              aria-label="Refresh"
              title="Refresh (delta sync)"
              disabled={refreshing}
              onClick={handleRefresh}
              sx={{ mr: "auto" }}
            >
              {refreshing ? <CircularProgress size={18} /> : <RefreshIcon />}
            </IconButton>
          )}
          {showPager && (
            <>
              {pageLoading && <CircularProgress size={16} sx={{ mr: 1 }} />}
              <Typography variant="body2" color="text.secondary">
                {start.toLocaleString()}–{end.toLocaleString()} of{" "}
                {total.toLocaleString()}
              </Typography>
              <IconButton
                size="small"
                aria-label="Newer messages"
                disabled={!canPrev}
                onClick={() => onPrev && onPrev()}
              >
                <ChevronLeftIcon />
              </IconButton>
              <IconButton
                size="small"
                aria-label="Older messages"
                disabled={!canNext}
                onClick={() => onNext && onNext()}
              >
                <ChevronRightIcon />
              </IconButton>
            </>
          )}
        </Box>
      )}

      {/* The scroll container. Only the rows inside the viewport are mounted,
          so this stays at 60fps even over a large mailbox. */}
      <Box ref={parentRef} sx={{ flex: 1, overflowY: "auto" }}>
        <Box
          sx={{
            height: `${rowVirtualizer.getTotalSize()}px`,
            position: "relative",
            width: "100%",
          }}
        >
          {items.map((virtualRow) => {
            const thread = threads[virtualRow.index];
            return (
              <Box
                key={thread.id}
                data-index={virtualRow.index}
                ref={rowVirtualizer.measureElement}
                sx={{
                  position: "absolute",
                  top: 0,
                  left: 0,
                  width: "100%",
                  transform: `translateY(${virtualRow.start}px)`,
                }}
              >
                <ThreadListItem
                  thread={thread}
                  isSelected={thread.id === selectedThreadId}
                  onClick={handleThreadClick}
                />
              </Box>
            );
          })}
        </Box>
      </Box>
    </Box>
  );
};

export default ThreadList;
