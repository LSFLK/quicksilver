import React from "react";
import { Box, Typography } from "@mui/material";
import AttachmentPreview from "./AttachmentPreview";

const AttachmentList = ({ attachments = [], onRemove, editable = true }) => {
  if (!attachments.length) return null;

  return (
    <Box sx={{ mt: 2 }}>
      <Typography variant="subtitle2" sx={{ mb: 1 }}>
        Attachments
      </Typography>
      <Box sx={{ display: "flex", flexDirection: "column", gap: 1 }}>
        {attachments.map((attachment) => (
          <AttachmentPreview
            key={attachment.id}
            attachment={attachment}
            onRemove={editable ? onRemove : undefined}
          />
        ))}
      </Box>
    </Box>
  );
};

export default AttachmentList;
