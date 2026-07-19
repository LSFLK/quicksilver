import { useEffect, useMemo, useRef, useState } from "react";
import {
  Box,
  Divider,
  IconButton,
  ListItemIcon,
  ListItemText,
  Menu,
  MenuItem,
} from "@mui/material";
import MoreVertIcon from "@mui/icons-material/MoreVert";
import ReplyIcon from "@mui/icons-material/Reply";
import ReplyAllIcon from "@mui/icons-material/ReplyAll";
import ForwardIcon from "@mui/icons-material/Forward";
import ContentCopyIcon from "@mui/icons-material/ContentCopy";
import MarkEmailUnreadIcon from "@mui/icons-material/MarkEmailUnread";
import ArchiveOutlinedIcon from "@mui/icons-material/ArchiveOutlined";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import DeleteForeverIcon from "@mui/icons-material/DeleteForever";
import MoveToInboxIcon from "@mui/icons-material/MoveToInbox";
import { Typography } from "@mui/material";
import MessageContent from "../atoms/MessageContent";
import MessageMeta from "../atoms/MessageMeta";
import AttachmentList from "./AttachmentList";
import AttachmentViewer from "./AttachmentViewer";
import { isRichHtml } from "../../nonview/email/htmlKind";
import { stripQuotedText } from "../../nonview/email/quotedText";
import { stripQuotedHtml } from "../../nonview/email/quotedHtml";

// Corner radii for bubble stacks: the sender-side corners of grouped bubbles
// shrink so consecutive messages visually "fuse" (DESIGN.md, Shapes).
const RADIUS = 18;
const FUSED_RADIUS = 6;

const MessageBubble = ({
  message,
  isSent,
  onDownloadAttachment,
  onFetchAttachment,
  isFirstInGroup = true,
  isLastInGroup = true,
  // Per-message actions (issue #40). When provided, the bubble grows a hover
  // kebab and a right-click context menu; called as onAction(action, message)
  // with action ∈ reply | replyAll | forward | copy | unread | archive | delete.
  onAction = undefined,
  // WhatsApp-style quoted preview (issue #43): { targetId, name, snippet } of
  // the message this one replies to, resolved by ThreadView. Null when the
  // message isn't a reply or the original isn't in the loaded conversation.
  replyTo = null,
}) => {
  // Replies hide their quoted chain (issue #43): plain text via
  // stripQuotedText, HTML via stripQuotedHtml. Richness is judged on the
  // stripped body — a two-line reply quoting a newsletter is a chat bubble,
  // not a full-width document.
  const isReply = !!message.inReplyTo;
  const displayHtml = useMemo(
    () =>
      isReply && message.contentHtml
        ? stripQuotedHtml(message.contentHtml)
        : message.contentHtml,
    [isReply, message.contentHtml],
  );
  // Full HTML email bodies are documents, not chat messages — they need the
  // whole column width. Plain-text replies stay in the narrow chat-bubble look.
  const rich = isRichHtml(displayHtml);
  // Chat view shows only the new text a reply added, not the quoted original
  // that replyContext.ts appends before sending.
  const displayText = rich ? message.content : stripQuotedText(message.content);

  // Scroll the conversation to the message this one replies to, with a brief
  // highlight pulse. The original may have left the DOM (virtual scrolling is
  // not used here, but it can be missing after a permanent delete) — no-op then.
  const jumpToOriginal = () => {
    if (!replyTo?.targetId || typeof document === "undefined") return;
    const el = document.querySelector(
      `[data-message-key="${CSS.escape(replyTo.targetId)}"]`,
    );
    if (!el) return;
    el.scrollIntoView({ behavior: "smooth", block: "center" });
    el.animate?.(
      [
        { boxShadow: "0 0 0 4px rgba(0, 242, 255, 0.55)" },
        { boxShadow: "0 0 0 4px rgba(0, 242, 255, 0)" },
      ],
      { duration: 1400, easing: "ease-out" },
    );
  };

  // Map the server attachment DTO (id/filename/mime_type/size) onto the shape
  // AttachmentPreview/AttachmentInfo expect (id/name/size).
  const attachments = (message.attachments || []).map((a) => ({
    id: a.id,
    name: a.filename,
    size: a.size,
    mimeType: a.mime_type,
  }));

  // In-app preview dialog state. The blob object URL is created here on open
  // and revoked on close/unmount so we never leak memory across previews.
  const [preview, setPreview] = useState(null);
  const urlRef = useRef(null);

  // Action menu state: anchored to the kebab (anchorEl) or to the right-click
  // position (position). Only one is set at a time.
  const [menu, setMenu] = useState(null);

  const revoke = () => {
    if (urlRef.current) {
      URL.revokeObjectURL(urlRef.current);
      urlRef.current = null;
    }
  };
  useEffect(() => revoke, []); // cleanup on unmount

  const handlePreview = async (att) => {
    if (!onFetchAttachment) return;
    revoke();
    setPreview({
      id: att.id,
      name: att.name,
      mimeType: att.mimeType,
      url: null,
      loading: true,
      error: null,
    });
    try {
      const blob = await onFetchAttachment(message.sourceThreadId, att.id);
      const url = URL.createObjectURL(blob);
      urlRef.current = url;
      setPreview((p) =>
        p ? { ...p, url, loading: false } : p,
      );
    } catch (e) {
      setPreview((p) =>
        p
          ? { ...p, loading: false, error: e?.message || "Preview failed" }
          : p,
      );
    }
  };

  const closePreview = () => {
    revoke();
    setPreview(null);
  };

  const handleContextMenu = (e) => {
    if (!onAction) return;
    e.preventDefault();
    setMenu({ position: { top: e.clientY, left: e.clientX } });
  };

  const closeMenu = () => setMenu(null);

  const selectAction = (action) => () => {
    closeMenu();
    onAction?.(action, message);
  };

  // Locally-appended optimistic messages have no server identity yet, so
  // flag/move operations can't target them.
  const hasServerIdentity = !!message.sourceThreadId;
  // "In Trash" state: the message was deleted (moved to Trash server-side)
  // but stays visible so it can be restored or purged.
  const isDeleted = !!message.deleted;
  // Restore/permanent-delete relocate the message in Trash by its Message-ID
  // header; ids synthesized from the UID ("msg-…") or local optimistic ids
  // can't be searched for.
  const hasMessageId =
    !!message.id && !message.id.startsWith("msg-") && !message.id.startsWith("local-");

  // Fused corners: outer corners keep the full radius; the sender-side corners
  // between grouped bubbles shrink. CSS order is TL TR BR BL.
  const topFuse = isFirstInGroup ? RADIUS : FUSED_RADIUS;
  const bottomFuse = isLastInGroup ? RADIUS : FUSED_RADIUS;
  const bubbleRadius = isSent
    ? `${RADIUS}px ${topFuse}px ${bottomFuse}px ${RADIUS}px`
    : `${topFuse}px ${RADIUS}px ${RADIUS}px ${bottomFuse}px`;

  return (
    <Box
      data-message-key={message.id}
      sx={{
        position: "relative",
        minWidth: 0,
        alignSelf: rich ? "stretch" : isSent ? "flex-end" : "flex-start",
        maxWidth: rich ? "100%" : "85%",
        "& .qs-msg-kebab": {
          opacity: 0,
          transition: "opacity 0.15s",
        },
        "&:hover .qs-msg-kebab, &:focus-within .qs-msg-kebab": {
          opacity: 1,
        },
      }}
    >
      {isDeleted && (
        <Box
          sx={{
            display: "flex",
            alignItems: "center",
            gap: 0.5,
            mb: 0.5,
            justifyContent: isSent ? "flex-end" : "flex-start",
            color: "error.main",
          }}
        >
          <DeleteOutlineIcon sx={{ fontSize: 15 }} />
          <Typography
            variant="caption"
            sx={{ fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase" }}
          >
            In Trash
          </Typography>
        </Box>
      )}
      <Box
        onContextMenu={handleContextMenu}
        sx={(theme) =>
          rich
            ? {
                // Rich HTML emails are documents, not chat lines: full-width
                // "high-clarity card" on an always-light surface so the email's
                // own colors stay readable in dark mode too. Deleted messages
                // swap the teal cyber-border for a red warning treatment.
                flex: 1,
                backgroundColor: isDeleted
                  ? "rgba(255, 241, 240, 0.95)"
                  : "rgba(255, 255, 255, 0.85)",
                color: "#191C1E",
                border: isDeleted
                  ? "1px solid rgba(186, 26, 26, 0.5)"
                  : "1px solid rgba(0, 105, 111, 0.10)",
                borderRadius: "16px",
                px: 2.5,
                py: 2,
                maxWidth: "100%",
                minWidth: 0,
                boxShadow: "0 4px 20px rgba(0, 0, 0, 0.03)",
                ...theme.applyStyles("dark", {
                  backgroundColor: isDeleted ? "#FFF1F0" : "#FFFFFF",
                  borderColor: isDeleted
                    ? "rgba(186, 26, 26, 0.6)"
                    : "rgba(255, 255, 255, 0.14)",
                  boxShadow: "0 4px 16px rgba(0, 0, 0, 0.4)",
                  // The card stays light in dark mode, so its meta row (timestamp,
                  // read check, attachment labels) must not use the dark scheme's
                  // near-white text tokens.
                  "& .MuiTypography-root, & .MuiSvgIcon-root": {
                    color: "#3A494B",
                  },
                }),
              }
            : {
                // Glass bubbles with hairline cyber-borders: sent gets the pale
                // electric-cyan tint, received stays white glass (DESIGN.md).
                // Deleted messages take a red warning tint in both schemes.
                backgroundColor: isDeleted
                  ? "rgba(186, 26, 26, 0.06)"
                  : isSent
                    ? "rgba(0, 242, 255, 0.12)"
                    : "rgba(255, 255, 255, 0.75)",
                color: "text.primary",
                border: isDeleted
                  ? "1px solid rgba(186, 26, 26, 0.45)"
                  : isSent
                    ? "1px solid rgba(0, 105, 111, 0.12)"
                    : "1px solid rgba(0, 105, 111, 0.08)",
                boxShadow: "0 2px 8px rgba(0, 0, 0, 0.03)",
                backdropFilter: "blur(10px)",
                borderRadius: bubbleRadius,
                px: 2,
                py: 1.25,
                width: "fit-content",
                maxWidth: "100%",
                minWidth: 0,
                // Dark mode: glass bubbles over the deep-space wallpaper — sent
                // gets a faint cyan tint and border, received a neutral glass.
                ...theme.applyStyles("dark", {
                  backgroundColor: isDeleted
                    ? "rgba(255, 180, 171, 0.08)"
                    : isSent
                      ? "rgba(0, 242, 255, 0.08)"
                      : "rgba(255, 255, 255, 0.07)",
                  color: "text.primary",
                  boxShadow: "none",
                  border: isDeleted
                    ? "1px solid rgba(255, 180, 171, 0.45)"
                    : isSent
                      ? "1px solid rgba(0, 242, 255, 0.18)"
                      : "1px solid rgba(255, 255, 255, 0.10)",
                  backdropFilter: "blur(10px)",
                }),
              }
        }
      >
        {replyTo && (
          <Box
            role="button"
            tabIndex={0}
            aria-label={`Show original message from ${replyTo.name}`}
            onClick={jumpToOriginal}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                jumpToOriginal();
              }
            }}
            sx={(theme) => ({
              display: "flex",
              flexDirection: "column",
              gap: 0.25,
              borderLeft: "3px solid",
              borderLeftColor: "primary.main",
              borderRadius: "6px",
              px: 1.25,
              py: 0.75,
              mb: 1,
              cursor: "pointer",
              backgroundColor: "rgba(0, 105, 111, 0.07)",
              transition: "background-color 0.15s",
              "&:hover": { backgroundColor: "rgba(0, 105, 111, 0.13)" },
              ...theme.applyStyles("dark", {
                backgroundColor: "rgba(255, 255, 255, 0.06)",
                "&:hover": { backgroundColor: "rgba(255, 255, 255, 0.10)" },
              }),
            })}
          >
            <Typography
              variant="caption"
              sx={{ fontWeight: 700, color: "primary.main", lineHeight: 1.2 }}
            >
              {replyTo.name}
            </Typography>
            {replyTo.snippet && (
              <Typography
                variant="caption"
                sx={{
                  opacity: 0.75,
                  lineHeight: 1.35,
                  display: "-webkit-box",
                  WebkitLineClamp: 2,
                  WebkitBoxOrient: "vertical",
                  overflow: "hidden",
                }}
              >
                {replyTo.snippet}
              </Typography>
            )}
          </Box>
        )}
        <MessageContent
          content={displayText}
          contentHtml={rich ? displayHtml : undefined}
        />
        <AttachmentList
          attachments={attachments}
          editable={false}
          onDownload={
            onDownloadAttachment
              ? (att) => onDownloadAttachment(message.sourceThreadId, att.id, att.name)
              : undefined
          }
          onPreview={onFetchAttachment ? handlePreview : undefined}
        />
        <MessageMeta
          timestamp={message.timestamp}
          isRead={message.isRead}
          isSent={isSent}
        />
      </Box>

      {onAction && (
        <IconButton
          className="qs-msg-kebab"
          size="small"
          aria-label="Message actions"
          onClick={(e) => setMenu({ anchorEl: e.currentTarget })}
          // Floats over the bubble's top-right corner; the contained paper
          // look keeps it visible over any bubble surface (including the
          // always-light rich-email card in dark mode).
          sx={{
            position: "absolute",
            top: 4,
            right: 4,
            width: 28,
            height: 28,
            color: "text.secondary",
            backgroundColor: "background.paper",
            border: "1px solid",
            borderColor: "divider",
            boxShadow: "0 2px 8px rgba(0, 0, 0, 0.12)",
            "&:hover": { backgroundColor: "background.paper" },
          }}
        >
          <MoreVertIcon fontSize="small" />
        </IconButton>
      )}

      {onAction && (
        <Menu
          open={!!menu}
          onClose={closeMenu}
          anchorEl={menu?.anchorEl}
          anchorReference={menu?.position ? "anchorPosition" : "anchorEl"}
          anchorPosition={menu?.position}
        >
          {isDeleted
            ? [
                // Trashed message: it can come back to the inbox or go for good.
                <MenuItem
                  key="restore"
                  onClick={selectAction("restore")}
                  disabled={!hasMessageId}
                >
                  <ListItemIcon><MoveToInboxIcon fontSize="small" /></ListItemIcon>
                  <ListItemText>Move to inbox</ListItemText>
                </MenuItem>,
                <MenuItem key="copy" onClick={selectAction("copy")}>
                  <ListItemIcon><ContentCopyIcon fontSize="small" /></ListItemIcon>
                  <ListItemText>Copy text</ListItemText>
                </MenuItem>,
                <Divider key="div" />,
                <MenuItem
                  key="purge"
                  onClick={selectAction("deletePermanent")}
                  disabled={!hasMessageId}
                  sx={{ color: "error.main" }}
                >
                  <ListItemIcon><DeleteForeverIcon fontSize="small" color="error" /></ListItemIcon>
                  <ListItemText>Delete permanently</ListItemText>
                </MenuItem>,
              ]
            : [
                <MenuItem key="reply" onClick={selectAction("reply")}>
                  <ListItemIcon><ReplyIcon fontSize="small" /></ListItemIcon>
                  <ListItemText>Reply</ListItemText>
                </MenuItem>,
                <MenuItem key="replyAll" onClick={selectAction("replyAll")}>
                  <ListItemIcon><ReplyAllIcon fontSize="small" /></ListItemIcon>
                  <ListItemText>Reply all</ListItemText>
                </MenuItem>,
                <MenuItem key="forward" onClick={selectAction("forward")}>
                  <ListItemIcon><ForwardIcon fontSize="small" /></ListItemIcon>
                  <ListItemText>Forward</ListItemText>
                </MenuItem>,
                <Divider key="div1" />,
                <MenuItem key="copy" onClick={selectAction("copy")}>
                  <ListItemIcon><ContentCopyIcon fontSize="small" /></ListItemIcon>
                  <ListItemText>Copy text</ListItemText>
                </MenuItem>,
                <Divider key="div2" />,
                <MenuItem
                  key="unread"
                  onClick={selectAction("unread")}
                  disabled={!hasServerIdentity}
                >
                  <ListItemIcon><MarkEmailUnreadIcon fontSize="small" /></ListItemIcon>
                  <ListItemText>Mark unread</ListItemText>
                </MenuItem>,
                <MenuItem
                  key="archive"
                  onClick={selectAction("archive")}
                  disabled={!hasServerIdentity}
                >
                  <ListItemIcon><ArchiveOutlinedIcon fontSize="small" /></ListItemIcon>
                  <ListItemText>Archive</ListItemText>
                </MenuItem>,
                <MenuItem
                  key="delete"
                  onClick={selectAction("delete")}
                  disabled={!hasServerIdentity}
                  sx={{ color: "error.main" }}
                >
                  <ListItemIcon><DeleteOutlineIcon fontSize="small" color="error" /></ListItemIcon>
                  <ListItemText>Delete</ListItemText>
                </MenuItem>,
              ]}
        </Menu>
      )}

      <AttachmentViewer
        open={!!preview}
        onClose={closePreview}
        url={preview?.url}
        mimeType={preview?.mimeType || ""}
        filename={preview?.name || "attachment"}
        loading={!!preview?.loading}
        error={preview?.error}
        onDownload={
          onDownloadAttachment && preview
            ? () => onDownloadAttachment(message.sourceThreadId, preview.id, preview.name)
            : null
        }
      />
    </Box>
  );
};

export default MessageBubble;
