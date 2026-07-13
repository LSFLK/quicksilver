import type { KeyboardEvent } from "react";
import { Box, IconButton, InputBase, Paper, Tooltip } from "@mui/material";
import ReplyAllIcon from "@mui/icons-material/ReplyAll";
import EditIcon from "@mui/icons-material/Edit";
import SendIcon from "@mui/icons-material/Send";

interface ReplyBarProps {
  value: string;
  onChange: (value: string) => void;
  onSend: () => void;
  onCustomize: () => void;
  onReplyAll: () => void;
  /** Whether more than one participant makes "Reply all" meaningful. */
  canReplyAll?: boolean;
  placeholder?: string;
  sending?: boolean;
}

// A real text input for a quick plain-text reply, sent inline on Enter/Send.
// The pen icon beside it opens the full compose popup (recipients, subject,
// templates, attachments) prefilled with whatever's been typed so far.
// Styled as a floating pill over the conversation wallpaper (DESIGN.md).
const ReplyBar = ({
  value,
  onChange,
  onSend,
  onCustomize,
  onReplyAll,
  canReplyAll = true,
  placeholder = "Reply to this conversation…",
  sending = false,
}: ReplyBarProps) => {
  const canSend = value.trim().length > 0 && !sending;

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      if (canSend) onSend();
    }
  };

  return (
    <Box sx={{ px: 2, pb: 2, pt: 1, backgroundColor: "transparent" }}>
      <Paper
        elevation={0}
        sx={(theme) => ({
          maxWidth: 960,
          mx: "auto",
          display: "flex",
          alignItems: "flex-end",
          gap: 0.5,
          p: "6px 6px 6px 8px",
          borderRadius: "16px",
          border: "1px solid",
          borderColor: "divider",
          // Frosted floating layer with a diffused matte-green lift on focus
          // (DESIGN.md, Elevation & Depth).
          backgroundColor: "rgba(255, 255, 255, 0.8)",
          backdropFilter: "blur(20px)",
          boxShadow: "0 6px 24px rgba(0, 0, 0, 0.05)",
          transition: "border-color 0.2s, box-shadow 0.2s",
          "&:focus-within": {
            borderColor: "rgba(61, 139, 78, 0.5)",
            boxShadow: "0 20px 40px -12px rgba(61, 139, 78, 0.15)",
          },
          ...theme.applyStyles("dark", {
            backgroundColor: "rgba(255, 255, 255, 0.05)",
            backdropFilter: "blur(20px)",
            borderColor: "rgba(255, 255, 255, 0.10)",
            boxShadow: "0 10px 30px rgba(0, 0, 0, 0.4)",
            "&:focus-within": {
              borderColor: "rgba(61, 139, 78, 0.4)",
              boxShadow: "0 10px 30px rgba(0, 0, 0, 0.5)",
            },
          }),
        })}
      >
        {canReplyAll && (
          <Tooltip title="Reply all">
            <IconButton
              onClick={onReplyAll}
              aria-label="Reply all"
              sx={{ color: "text.secondary" }}
            >
              <ReplyAllIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        )}
        <Tooltip title="Customize (recipients, subject, formatting…)">
          <IconButton
            onClick={onCustomize}
            aria-label="Customize reply"
            sx={{ color: "text.secondary" }}
          >
            <EditIcon fontSize="small" />
          </IconButton>
        </Tooltip>
        <InputBase
          fullWidth
          multiline
          maxRows={6}
          placeholder={placeholder}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={sending}
          inputProps={{ "aria-label": placeholder }}
          sx={{ flex: 1, px: 1, py: "8px", fontSize: "0.9375rem" }}
        />
        <Tooltip title="Send">
          <span>
            <IconButton
              onClick={onSend}
              disabled={!canSend}
              aria-label="Send reply"
              sx={(theme) => ({
                width: 40,
                height: 40,
                borderRadius: "12px",
                // Solid matte-green action with light glyph (DESIGN.md, Buttons).
                backgroundColor: "#3D8B4E",
                color: "#F0F5F1",
                border: "1px solid rgba(61, 139, 78, 0.4)",
                boxShadow: "none",
                transition: "transform 0.15s, background-color 0.2s, box-shadow 0.2s",
                "&:hover": {
                  backgroundColor: "#4A9E5C",
                  transform: "scale(1.05)",
                },
                "&.Mui-disabled": {
                  backgroundColor: "action.disabledBackground",
                  color: "action.disabled",
                  border: "1px solid transparent",
                  boxShadow: "none",
                },
                // Dark mode: translucent matte-green button.
                ...theme.applyStyles("dark", {
                  backgroundColor: "rgba(61, 139, 78, 0.15)",
                  color: "#A5E0B0",
                  border: "1px solid rgba(61, 139, 78, 0.4)",
                  boxShadow: "none",
                  "&:hover": {
                    backgroundColor: "rgba(61, 139, 78, 0.25)",
                    transform: "scale(1.05)",
                  },
                  "&.Mui-disabled": {
                    backgroundColor: "rgba(255, 255, 255, 0.06)",
                    border: "1px solid rgba(255, 255, 255, 0.08)",
                    color: "rgba(255, 255, 255, 0.25)",
                    boxShadow: "none",
                  },
                }),
              })}
            >
              <SendIcon fontSize="small" />
            </IconButton>
          </span>
        </Tooltip>
      </Paper>
    </Box>
  );
};

export default ReplyBar;
