import React from "react";
import { Box, Typography } from "@mui/material";

const formatFileSize = (size) => {
  if (!size && size !== 0) return "";
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
  if (size < 1024 * 1024 * 1024)
    return `${(size / (1024 * 1024)).toFixed(1)} MB`;
  return `${(size / (1024 * 1024 * 1024)).toFixed(1)} GB`;
};

const AttachmentInfo = ({ name, size }) => {
  return (
    <Box sx={{ minWidth: 0 }}>
      <Typography variant="body2" noWrap>
        {name}
      </Typography>
      <Typography variant="caption" color="text.secondary">
        {formatFileSize(size)}
      </Typography>
    </Box>
  );
};

export default AttachmentInfo;
