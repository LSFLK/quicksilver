import React from "react";
import { Typography } from "@mui/material";

const ParticipantList = ({ participants = [], max = 2 }) => {
  if (!participants || participants.length === 0) {
    return (
      <Typography variant="body2" color="text.secondary">
        No participants
      </Typography>
    );
  }

  const visible = participants.slice(0, max).map((p) => p.name || p.email);
  const remaining = participants.length - visible.length;

  return (
    <Typography variant="body2" color="text.secondary" noWrap>
      {visible.join(", ")}
      {remaining > 0 ? ` +${remaining} more` : ""}
    </Typography>
  );
};

export default ParticipantList;
