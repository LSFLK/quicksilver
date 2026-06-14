import React from "react";
import { Box, CircularProgress } from "@mui/material";
import MessageGroup from "./MessageGroup";

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

const ThreadView = ({ thread, messages = [], loading = false }) => {
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

  const groups = groupMessages(messages);

  return (
    <Box sx={{ p: 2, display: "flex", flexDirection: "column" }}>
      {groups.map((group, index) => (
        <MessageGroup
          key={`${group.sender?.id}-${index}`}
          messages={group.messages}
          sender={group.sender}
        />
      ))}
    </Box>
  );
};

export default ThreadView;
