import React from "react";
import { Box, IconButton as MuiIconButton, Avatar } from "@mui/material";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import { useNavigate } from "react-router-dom";
import { getInitials } from "../_constants/avatarUtils";
import ParticipantList from "../atoms/ParticipantList";
import ThreadActions from "./ThreadActions";

const ThreadHeader = ({ thread, onAction }) => {
  const navigate = useNavigate();
  const participantName = thread?.participants?.[0]?.name || "Unknown";

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
      <Box sx={{ display: "flex", alignItems: "center", gap: 2, minWidth: 0 }}>
        <MuiIconButton aria-label="back" onClick={() => navigate(-1)}>
          <ArrowBackIcon />
        </MuiIconButton>
        <Avatar sx={{ width: 40, height: 40 }}>
          {getInitials(participantName)}
        </Avatar>
        <ParticipantList participants={thread?.participants || []} />
      </Box>
      <ThreadActions threadId={thread?.id} onAction={onAction} />
    </Box>
  );
};

export default ThreadHeader;
