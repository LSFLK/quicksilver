import React from "react";
import { Box, IconButton } from "@mui/material";
import DeleteIcon from "@mui/icons-material/Delete";
import MarkEmailUnreadIcon from "@mui/icons-material/MarkEmailUnread";
import MoreVertIcon from "@mui/icons-material/MoreVert";
import ArchiveIcon from "@mui/icons-material/Archive";

const ThreadActions = ({ threadId, onAction }) => {
  const handleAction = (action) => () => {
    if (onAction) {
      onAction(action, threadId);
    }
  };

  return (
    <Box sx={{ display: "flex", gap: 1 }}>
      <IconButton aria-label="archive" onClick={handleAction("archive")}>
        <ArchiveIcon />
      </IconButton>
      <IconButton aria-label="delete" onClick={handleAction("delete")}>
        <DeleteIcon />
      </IconButton>
      <IconButton aria-label="mark unread" onClick={handleAction("unread")}>
        <MarkEmailUnreadIcon />
      </IconButton>
      <IconButton aria-label="more" onClick={handleAction("more")}>
        <MoreVertIcon />
      </IconButton>
    </Box>
  );
};

export default ThreadActions;
