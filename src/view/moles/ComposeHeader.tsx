import { useEffect, useRef, useState } from "react";
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  IconButton,
  Snackbar,
  Typography,
} from "@mui/material";
import CloseIcon from "@mui/icons-material/Close";
import SendIcon from "@mui/icons-material/Send";
import { useNavigate } from "react-router-dom";

const ComposeHeader = ({ onClose, onSend, title = "New Message", sendLabel = "Send" }) => {
  const navigate = useNavigate();
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Avoid a state update after the page navigates away on a successful send.
  const mounted = useRef(true);
  useEffect(() => () => {
    mounted.current = false;
  }, []);

  const handleClose = () => {
    if (onClose) {
      onClose();
    } else {
      navigate("/inbox");
    }
  };

  const handleSend = async () => {
    if (sending) return;
    setSending(true);
    setError(null);
    try {
      await onSend?.();
      // On success onSend navigates away; component unmounts, nothing to reset.
    } catch (e) {
      if (mounted.current) {
        setError(e instanceof Error ? e.message : "Couldn't send the message. Please try again.");
        setSending(false);
      }
    }
  };

  return (
    <Box
      sx={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        p: 2,
        borderBottom: 1,
        borderColor: "divider",
        backgroundColor: "background.paper",
      }}
    >
      <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
        <IconButton aria-label="close" onClick={handleClose} disabled={sending}>
          <CloseIcon />
        </IconButton>
        <Typography variant="h6">{title}</Typography>
      </Box>
      <Button
        variant="contained"
        color="primary"
        onClick={handleSend}
        disabled={sending}
        startIcon={
          sending ? (
            <CircularProgress size={16} color="inherit" />
          ) : (
            <SendIcon fontSize="small" />
          )
        }
        sx={{ minWidth: 120 }}
      >
        {sending ? "Sending…" : sendLabel}
      </Button>

      <Snackbar
        open={Boolean(error)}
        autoHideDuration={6000}
        onClose={() => setError(null)}
        anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
      >
        <Alert severity="error" variant="filled" onClose={() => setError(null)}>
          {error}
        </Alert>
      </Snackbar>
    </Box>
  );
};

export default ComposeHeader;
