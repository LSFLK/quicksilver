import { Box, Button, Stack } from "@mui/material";
import ReplyIcon from "@mui/icons-material/Reply";
import ReplyAllIcon from "@mui/icons-material/ReplyAll";
import ForwardIcon from "@mui/icons-material/Forward";

interface ReplyBarProps {
  onReply: () => void;
  onReplyAll: () => void;
  onForward: () => void;
  /** Whether more than one participant makes "Reply all" meaningful. */
  canReplyAll?: boolean;
  placeholder?: string;
}

// Replaces the old inline reply input. Looks like a compose prompt: clicking the
// prompt (or any action) opens the full compose interface in a popup, prefilled
// for reply / reply-all / forward.
const ReplyBar = ({
  onReply,
  onReplyAll,
  onForward,
  canReplyAll = true,
  placeholder = "Reply to this conversation…",
}: ReplyBarProps) => {
  return (
    <Box
      sx={{
        p: 2,
        borderTop: 1,
        borderColor: "divider",
        backgroundColor: "background.paper",
        display: "flex",
        flexDirection: { xs: "column", sm: "row" },
        alignItems: { xs: "stretch", sm: "center" },
        gap: 1.5,
      }}
    >
      <Box
        role="button"
        tabIndex={0}
        onClick={onReply}
        onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && onReply()}
        sx={{
          flex: 1,
          px: 2,
          py: 1.25,
          borderRadius: 999,
          border: 1,
          borderColor: "divider",
          color: "text.secondary",
          cursor: "text",
          userSelect: "none",
          transition: "border-color 0.15s ease, background-color 0.15s ease",
          "&:hover": { borderColor: "primary.main", backgroundColor: "action.hover" },
        }}
      >
        {placeholder}
      </Box>
      <Stack direction="row" spacing={1} sx={{ flexShrink: 0 }}>
        <Button variant="contained" startIcon={<ReplyIcon />} onClick={onReply}>
          Reply
        </Button>
        {canReplyAll && (
          <Button variant="outlined" startIcon={<ReplyAllIcon />} onClick={onReplyAll}>
            Reply all
          </Button>
        )}
        <Button variant="text" startIcon={<ForwardIcon />} onClick={onForward}>
          Forward
        </Button>
      </Stack>
    </Box>
  );
};

export default ReplyBar;
