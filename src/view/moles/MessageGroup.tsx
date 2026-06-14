import React from "react";
import { Box, Avatar } from "@mui/material";
import { getInitials } from "../_constants/avatarUtils";
import MessageBubble from "./MessageBubble";

const MessageGroup = ({ messages = [], sender }) => {
  if (!messages.length) return null;

  const isSent = sender?.id === "current";
  const senderName = sender?.name || "Unknown";

  return (
    <Box sx={{ display: "flex", gap: 2, mb: 2, alignItems: "flex-start" }}>
      {!isSent && (
        <Avatar sx={{ width: 32, height: 32, fontSize: "0.875rem" }}>
          {getInitials(senderName)}
        </Avatar>
      )}
      <Box sx={{ display: "flex", flexDirection: "column", gap: 1, flex: 1 }}>
        {messages.map((message) => (
          <MessageBubble key={message.id} message={message} isSent={isSent} />
        ))}
      </Box>
    </Box>
  );
};

export default MessageGroup;
