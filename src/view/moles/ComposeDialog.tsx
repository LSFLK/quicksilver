import { Dialog, useMediaQuery, useTheme } from "@mui/material";
import ComposePanel, {
  type ComposeInitial,
  type QuotedOriginal,
  type SentSummary,
  type ThreadContext,
} from "./ComposePanel";

interface ComposeDialogProps {
  open: boolean;
  onClose: () => void;
  /** Called after a successful send (dialog should close + optionally notify). */
  onSent: (sent: SentSummary) => void;
  initial?: ComposeInitial;
  threadContext?: ThreadContext;
  quote?: QuotedOriginal;
  title?: string;
  sendLabel?: string;
}

// Hosts the shared ComposePanel inside a modal so replying/forwarding uses the
// exact same compose interface as the full Compose page. Full-screen on small
// viewports; a centered large dialog on desktop.
const ComposeDialog = ({
  open,
  onClose,
  onSent,
  initial,
  threadContext,
  quote,
  title = "New Message",
  sendLabel = "Send",
}: ComposeDialogProps) => {
  const theme = useTheme();
  const fullScreen = useMediaQuery(theme.breakpoints.down("md"));

  return (
    <Dialog
      open={open}
      onClose={onClose}
      fullScreen={fullScreen}
      fullWidth
      maxWidth="lg"
      // Keep the panel unmounted when closed so each open starts fresh with the
      // latest reply context (recipients, subject, threading headers).
      keepMounted={false}
      PaperProps={{
        sx: {
          height: fullScreen ? "100%" : "90vh",
          display: "flex",
          flexDirection: "column",
        },
      }}
    >
      <ComposePanel
        initial={initial}
        threadContext={threadContext}
        quote={quote}
        title={title}
        sendLabel={sendLabel}
        onClose={onClose}
        onSent={onSent}
        onSavedDraft={onClose}
      />
    </Dialog>
  );
};

export default ComposeDialog;
