import React from "react";
import { Box, Typography, Avatar } from "@mui/material";
import { getInitials, getAvatarColor } from "../_constants/avatarUtils";
import Timestamp from "../atoms/Timestamp";
import AttachFileIcon from "@mui/icons-material/AttachFile";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";

const ThreadListItem = ({ thread, isSelected = false, onClick, onPrefetch = undefined }) => {
  const {
    id,
    subject,
    participants,
    lastMessage,
    lastMessageTime,
    unreadCount,
    hasAttachment,
    isTrashed,
  } = thread;

  const participantName = participants?.[0]?.name || "Unknown";
  const isUnread = unreadCount > 0;

  return (
    <Box
      onClick={() => onClick(id)}
      // Predictive prefetch (proposal §7): warm this thread's body into the
      // cache the moment the pointer/focus lands on it, so the open is instant.
      onMouseEnter={onPrefetch ? () => onPrefetch(id) : undefined}
      onFocus={onPrefetch ? () => onPrefetch(id) : undefined}
      sx={{
        position: "relative",
        display: "flex",
        gap: 1.5,
        px: 2,
        py: 1.5,
        cursor: "pointer",
        backgroundColor: isSelected ? "action.selected" : "transparent",
        "&:hover": {
          backgroundColor: isSelected ? "action.selected" : "action.hover",
        },
        transition: "background-color 0.15s",
        // Selected accent bar — electric cyan with an LED glow, flush with
        // the pane edge (DESIGN.md, Status Indicators).
        "&::before": {
          content: '""',
          position: "absolute",
          left: 0,
          top: 6,
          bottom: 6,
          width: 3,
          borderRadius: "0 3px 3px 0",
          backgroundColor: "#00F2FF",
          boxShadow: "0 0 10px rgba(0, 242, 255, 0.5)",
          opacity: isSelected ? 1 : 0,
          transition: "opacity 0.15s",
        },
      }}
    >
      {/* Avatar */}
      <Avatar sx={{ width: 44, height: 44, fontSize: "1rem", ...getAvatarColor(participantName) }}>
        {getInitials(participantName)}
      </Avatar>

      {/* Thread Content — dimmed when the whole conversation sits in Trash. */}
      <Box sx={{ flex: 1, minWidth: 0, opacity: isTrashed ? 0.7 : 1 }}>
        {/* First Row: Participant Name and Timestamp */}
        <Box
          sx={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "baseline",
            gap: 1,
            mb: 0.25,
          }}
        >
          <Typography
            variant="body1"
            sx={{
              fontWeight: isUnread ? 700 : 500,
              fontSize: "0.9375rem",
            }}
            noWrap
          >
            {participantName}
          </Typography>
          <Box
            sx={{
              flexShrink: 0,
              "& .MuiTypography-root": {
                color: isUnread ? "primary.main" : "text.secondary",
                fontWeight: isUnread ? 700 : 500,
              },
            }}
          >
            <Timestamp date={lastMessageTime} format="relative" />
          </Box>
        </Box>

        {/* Second Row: Subject */}
        <Typography
          variant="body2"
          sx={{
            fontWeight: isUnread ? 700 : 400,
            color: isUnread ? "primary.main" : "text.primary",
            mb: 0.25,
          }}
          noWrap
        >
          {subject}
        </Typography>

        {/* Third Row: Preview and Indicators */}
        <Box
          sx={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            gap: 1,
          }}
        >
          <Typography
            variant="body2"
            color="text.secondary"
            sx={{ flex: 1, minWidth: 0, opacity: 0.85, fontSize: "0.8125rem" }}
            noWrap
          >
            {lastMessage}
          </Typography>

          <Box sx={{ display: "flex", gap: 0.75, alignItems: "center", flexShrink: 0 }}>
            {isTrashed && (
              <DeleteOutlineIcon
                titleAccess="In Trash"
                sx={{ fontSize: 16, color: "error.main" }}
              />
            )}
            {hasAttachment && (
              <AttachFileIcon sx={{ fontSize: 16, color: "text.secondary" }} />
            )}
            {unreadCount > 0 && (
              <Box
                sx={{
                  minWidth: 20,
                  height: 20,
                  px: 0.75,
                  borderRadius: 999,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  // Matte-green unread badge with light count.
                  backgroundColor: "#3D8B4E",
                  color: "#F0F5F1",
                  fontSize: "0.6875rem",
                  fontWeight: 700,
                  lineHeight: 1,
                }}
              >
                {unreadCount}
              </Box>
            )}
          </Box>
        </Box>
      </Box>
    </Box>
  );
};

export default ThreadListItem;
