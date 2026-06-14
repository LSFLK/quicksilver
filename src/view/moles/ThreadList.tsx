import React, { useEffect, useRef } from "react";
import { Box, CircularProgress } from "@mui/material";
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
  // Infinite scroll: onLoadMore is invoked when the user nears the end of the
  // list and hasMore is true. loadingMore shows a footer spinner.
  onLoadMore = undefined,
  hasMore = false,
  loadingMore = false,
}) => {
  const navigate = useNavigate();
  const parentRef = useRef(null);

  const rowVirtualizer = useVirtualizer({
    count: threads?.length || 0,
    getScrollElement: () => parentRef.current,
    estimateSize: () => ESTIMATED_ROW_HEIGHT,
    // Render a few extra rows above/below the viewport so fast scrolling
    // doesn't flash blank space.
    overscan: 8,
  });

  const items = rowVirtualizer.getVirtualItems();
  const lastIndex = items.length ? items[items.length - 1].index : -1;

  // When the last row scrolls into view (overscan included), pull the next
  // page. Depending on the primitive lastIndex keeps this from firing on every
  // virtualizer recalculation.
  useEffect(() => {
    if (lastIndex < 0) return;
    if (
      lastIndex >= (threads?.length || 0) - 1 &&
      hasMore &&
      !loadingMore &&
      onLoadMore
    ) {
      onLoadMore();
    }
  }, [lastIndex, threads?.length, hasMore, loadingMore, onLoadMore]);

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
    // The scroll container. Only the rows inside the viewport are mounted, so
    // this stays at 60fps even over a 50k-message mailbox.
    <Box
      ref={parentRef}
      sx={{
        height: "100%",
        overflowY: "auto",
        backgroundColor: "background.paper",
      }}
    >
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

      {/* Footer spinner shown while the next page is loading. Sits below the
          virtualized sizer (which already reserves the full list height). */}
      {loadingMore && (
        <Box
          sx={{
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            p: 2,
          }}
        >
          <CircularProgress size={24} />
        </Box>
      )}
    </Box>
  );
};

export default ThreadList;
