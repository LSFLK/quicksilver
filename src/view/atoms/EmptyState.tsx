import React from "react";
import { Box, Typography } from "@mui/material";
import InboxIcon from "@mui/icons-material/Inbox";

const EmptyState = ({ icon: CustomIcon, title, description, action }) => {
  const Icon = CustomIcon || InboxIcon;

  return (
    <Box
      sx={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: 4,
        textAlign: "center",
      }}
    >
      <Icon sx={{ fontSize: 64, color: "text.secondary", mb: 2 }} />
      <Typography variant="h6" color="text.primary" gutterBottom>
        {title}
      </Typography>
      {description && (
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          {description}
        </Typography>
      )}
      {action}
    </Box>
  );
};

export default EmptyState;
