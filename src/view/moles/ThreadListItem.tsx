import React from "react";
import { Box, Typography, Avatar, Badge } from "@mui/material";
import { getInitials } from "../_constants/avatarUtils";
import Timestamp from "../atoms/Timestamp";
import AttachFileIcon from "@mui/icons-material/AttachFile";

const ThreadListItem = ({ thread, isSelected = false, onClick }) => {
  const {
    id,
    subject,
    participants,
    lastMessage,
    lastMessageTime,
    unreadCount,
    hasAttachment,
  } = thread;

  const participantName = participants?.[0]?.name || "Unknown";
  const isUnread = unreadCount > 0;

  return (
    <Box
      onClick={() => onClick(id)}
      sx={{
        display: "flex",
        gap: 2,
        p: 2,
        cursor: "pointer",
        backgroundColor: isSelected ? "action.selected" : "transparent",
        borderBottom: 1,
        borderColor: "divider",
        "&:hover": {
          backgroundColor: isSelected ? "action.selected" : "action.hover",
        },
        transition: "background-color 0.2s",
      }}
    >
      {/* Avatar */}
      <Avatar sx={{ width: 40, height: 40 }}>
        {getInitials(participantName)}
      </Avatar>

      {/* Thread Content */}
      <Box sx={{ flex: 1, minWidth: 0 }}>
        {/* First Row: Participant Name and Timestamp */}
        <Box
          sx={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            mb: 0.5,
          }}
        >
          <Typography
            variant="body1"
            sx={{
              fontWeight: isUnread ? 600 : 400,
              color: isUnread ? "text.primary" : "text.primary",
            }}
            noWrap
          >
            {participantName}
          </Typography>
          <Timestamp date={lastMessageTime} format="relative" />
        </Box>

        {/* Second Row: Subject */}
        <Typography
          variant="body2"
          sx={{
            fontWeight: isUnread ? 600 : 400,
            color: "text.primary",
            mb: 0.5,
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
          }}
        >
          <Typography
            variant="body2"
            color="text.secondary"
            sx={{ flex: 1, minWidth: 0 }}
            noWrap
          >
            {lastMessage}
          </Typography>

          <Box sx={{ display: "flex", gap: 1, alignItems: "center", ml: 1 }}>
            {hasAttachment && (
              <AttachFileIcon sx={{ fontSize: 16, color: "text.secondary" }} />
            )}
            {unreadCount > 0 && (
              <Badge badgeContent={unreadCount} color="primary" />
            )}
          </Box>
        </Box>
      </Box>
    </Box>
  );
};

export default ThreadListItem;
