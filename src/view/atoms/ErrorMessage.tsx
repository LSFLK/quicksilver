import React from "react";
import { Alert, IconButton } from "@mui/material";
import CloseIcon from "@mui/icons-material/Close";

const ErrorMessage = ({ message, onDismiss, severity = "error", variant }) => {
  if (!message) return null;

  // Support variant prop for backward compatibility
  const alertSeverity = variant === "success" ? "success" : severity;

  return (
    <Alert
      severity={alertSeverity}
      action={
        onDismiss && (
          <IconButton
            aria-label="close"
            color="inherit"
            size="small"
            onClick={onDismiss}
          >
            <CloseIcon fontSize="inherit" />
          </IconButton>
        )
      }
    >
      {message}
    </Alert>
  );
};

export default ErrorMessage;
