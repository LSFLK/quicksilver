import { Box } from "@mui/material";
import MessageContent from "../atoms/MessageContent";
import MessageMeta from "../atoms/MessageMeta";

const MessageBubble = ({ message, isSent }) => {
  // Full HTML email bodies are documents, not chat messages — they need the
  // whole column width. Plain-text replies stay in the narrow chat-bubble look.
  const wide = !!message.contentHtml;

  return (
    <Box
      sx={{
        alignSelf: wide ? "stretch" : isSent ? "flex-end" : "flex-start",
        backgroundColor: isSent ? "primary.main" : "background.paper",
        color: isSent ? "primary.contrastText" : "text.primary",
        borderRadius: 2,
        px: 2,
        py: 1.5,
        width: wide ? "100%" : "auto",
        maxWidth: wide ? "100%" : "75%",
        minWidth: 0,
        boxShadow: 1,
      }}
    >
      <MessageContent
        content={message.content}
        contentHtml={message.contentHtml}
      />
      <MessageMeta
        timestamp={message.timestamp}
        isRead={message.isRead}
        isSent={isSent}
      />
    </Box>
  );
};

export default MessageBubble;
