import React, { useState } from "react";
import { Box, IconButton, TextField } from "@mui/material";
import AttachFileIcon from "@mui/icons-material/AttachFile";
import EmojiEmotionsIcon from "@mui/icons-material/EmojiEmotions";
import SendIcon from "@mui/icons-material/Send";

const MessageComposer = ({
  threadId,
  onSend,
  placeholder = "Write a message...",
}) => {
  const [value, setValue] = useState("");

  const handleSend = () => {
    if (!value.trim()) return;
    if (onSend) {
      onSend({ threadId, content: value.trim() });
    }
    setValue("");
  };

  return (
    <Box
      sx={{
        p: 2,
        borderTop: 1,
        borderColor: "divider",
        backgroundColor: "background.paper",
        display: "flex",
        alignItems: "flex-end",
        gap: 1,
      }}
    >
      <IconButton aria-label="attach">
        <AttachFileIcon />
      </IconButton>
      <IconButton aria-label="emoji">
        <EmojiEmotionsIcon />
      </IconButton>
      <Box sx={{ flex: 1 }}>
        <TextField
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder={placeholder}
          fullWidth
          variant="outlined"
          multiline
          minRows={1}
          maxRows={6}
        />
      </Box>
      <IconButton aria-label="send" onClick={handleSend}>
        <SendIcon />
      </IconButton>
    </Box>
  );
};

export default MessageComposer;
