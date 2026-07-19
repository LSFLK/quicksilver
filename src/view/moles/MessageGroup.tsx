import React from "react";
import { Box, Avatar, Tooltip, Typography } from "@mui/material";
import { getInitials, getAvatarColor } from "../_constants/avatarUtils";
import MessageBubble from "./MessageBubble";
import { useAccount } from "../../nonview/core/AccountContext";

// One "To: a, b" / "Cc: c" line inside the avatar hover-card.
const AddressLine = ({ label, people }) => {
  if (!people || people.length === 0) return null;
  const text = people
    .map((p) => (p.name && p.name !== p.email ? `${p.name} <${p.email}>` : p.email || p.name))
    .join(", ");
  return (
    <Typography variant="caption" component="div" sx={{ opacity: 0.9 }}>
      <Box component="span" sx={{ fontWeight: 700 }}>{label}:</Box> {text}
    </Typography>
  );
};

const MessageGroup = ({
  messages = [],
  sender,
  onDownloadAttachment,
  onFetchAttachment,
  onMessageAction = undefined,
  resolveReplyTo = undefined,
}) => {
  const { activeAccount } = useAccount();

  if (!messages.length) return null;

  const isSent = sender?.id === "current" || (activeAccount?.email && sender?.email === activeAccount?.email);
  const senderName = sender?.name || "Unknown";

  // Addressing details for the hover-card (issue #40). Recipients rarely vary
  // within one consecutive-sender group, so the first message stands in for
  // the group. Bcc is never exposed by IMAP for received mail.
  const first = messages[0];
  const addressCard = (
    <Box sx={{ p: 0.5, display: "flex", flexDirection: "column", gap: 0.25 }}>
      <Typography variant="caption" component="div" sx={{ fontWeight: 700 }}>
        {senderName}
      </Typography>
      {sender?.email && (
        <Typography variant="caption" component="div" sx={{ opacity: 0.9 }}>
          {sender.email}
        </Typography>
      )}
      <AddressLine label="To" people={first.to} />
      <AddressLine label="Cc" people={first.cc} />
    </Box>
  );

  return (
    <Box sx={{ display: "flex", gap: 1.5, mb: 2, alignItems: "flex-end" }}>
      {!isSent && (
        <Tooltip title={addressCard} placement="right-start" arrow>
          <Avatar
            tabIndex={0}
            aria-label={`Sender details: ${senderName}`}
            sx={{
              width: 32,
              height: 32,
              fontSize: "0.8125rem",
              mb: 2.5, // keep the avatar level with the last bubble, above its meta row
              cursor: "default",
              ...getAvatarColor(senderName),
            }}
          >
            {getInitials(senderName)}
          </Avatar>
        </Tooltip>
      )}
      <Box
        sx={{
          display: "flex",
          flexDirection: "column",
          gap: "4px", // group-gap: sequential messages from one sender fuse tightly
          flex: 1,
          minWidth: 0,
        }}
      >
        {!isSent && (
          <Typography
            variant="caption"
            sx={{ color: "text.secondary", fontWeight: 600, ml: 1, mb: 0.25 }}
          >
            {senderName}
          </Typography>
        )}
        {messages.map((message, index) => (
          <MessageBubble
            key={message.id}
            message={message}
            isSent={isSent}
            isFirstInGroup={index === 0}
            isLastInGroup={index === messages.length - 1}
            onDownloadAttachment={onDownloadAttachment}
            onFetchAttachment={onFetchAttachment}
            onAction={onMessageAction}
            replyTo={resolveReplyTo ? resolveReplyTo(message) : null}
          />
        ))}
      </Box>
    </Box>
  );
};

export default MessageGroup;
