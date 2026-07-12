import React, { useCallback, useMemo } from "react";
import { Box } from "@mui/material";
import MessageGroup from "./MessageGroup";
import MessageSkeleton from "../atoms/MessageSkeleton";
import { stripQuotedText } from "../../nonview/email/quotedText";

const groupMessages = (messages = []) => {
  const groups = [];
  let currentGroup = null;

  messages.forEach((message) => {
    const senderId = message.sender?.id;
    if (!currentGroup || currentGroup.sender?.id !== senderId) {
      currentGroup = { sender: message.sender, messages: [message] };
      groups.push(currentGroup);
    } else {
      currentGroup.messages.push(message);
    }
  });

  return groups;
};

// Message-IDs appear with and without their angle brackets depending on the
// header/DTO they came from; compare them normalised.
const normalizeMessageId = (id) => (id || "").trim().replace(/^<|>$/g, "");

const ThreadView = ({
  thread,
  messages = [],
  loading = false,
  onDownloadAttachment,
  onFetchAttachment,
  onMessageAction = undefined,
}) => {
  // Reply → original lookup for the WhatsApp-style quoted preview (issue
  // #43): match a reply's In-Reply-To against the thread's Message-IDs.
  const byMessageId = useMemo(() => {
    const map = new Map();
    messages.forEach((m) => {
      const key = normalizeMessageId(m.id);
      if (key) map.set(key, m);
    });
    return map;
  }, [messages]);

  const resolveReplyTo = useCallback(
    (message) => {
      if (!message?.inReplyTo) return null;
      const parent = byMessageId.get(normalizeMessageId(message.inReplyTo));
      if (!parent || parent.id === message.id) return null;
      return {
        targetId: parent.id,
        name: parent.sender?.name || parent.sender?.email || "Unknown",
        snippet: stripQuotedText(parent.content || "").slice(0, 160),
      };
    },
    [byMessageId],
  );

  if (loading) {
    return <MessageSkeleton />;
  }

  const groups = groupMessages(messages);

  return (
    <Box
      sx={{
        px: { xs: 2, md: 3 },
        py: 3,
        display: "flex",
        flexDirection: "column",
        maxWidth: 960,
        mx: "auto",
        width: "100%",
        boxSizing: "border-box",
        "@keyframes qs-bubble-in": {
          from: { opacity: 0, transform: "translateY(6px)" },
          to: { opacity: 1, transform: "translateY(0)" },
        },
        "& > *": {
          animation: "qs-bubble-in 0.25s ease both",
        },
      }}
    >
      {groups.map((group, index) => (
        <MessageGroup
          key={`${group.sender?.id}-${index}`}
          messages={group.messages}
          sender={group.sender}
          onDownloadAttachment={onDownloadAttachment}
          onFetchAttachment={onFetchAttachment}
          onMessageAction={onMessageAction}
          resolveReplyTo={resolveReplyTo}
        />
      ))}
    </Box>
  );
};

export default ThreadView;
