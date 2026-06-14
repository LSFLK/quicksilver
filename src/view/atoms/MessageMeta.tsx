import React from "react";
import { Box } from "@mui/material";
import CheckIcon from "@mui/icons-material/Check";
import Timestamp from "./Timestamp";

const MessageMeta = ({ timestamp, isRead, isSent }) => {
  return (
    <Box
      sx={{
        display: "flex",
        alignItems: "center",
        gap: 0.5,
        justifyContent: isSent ? "flex-end" : "flex-start",
        mt: 0.5,
      }}
    >
      <Timestamp date={timestamp} format="time-only" />
      {isSent && (
        <CheckIcon
          sx={{
            fontSize: 14,
            color: isRead ? "primary.main" : "text.secondary",
          }}
        />
      )}
    </Box>
  );
};

export default MessageMeta;
