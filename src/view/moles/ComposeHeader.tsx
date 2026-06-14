import React from "react";
import { Box, Typography, IconButton, Button } from "@mui/material";
import CloseIcon from "@mui/icons-material/Close";
import { useNavigate } from "react-router-dom";

const ComposeHeader = ({ onClose, onSend }) => {
  const navigate = useNavigate();

  const handleClose = () => {
    if (onClose) {
      onClose();
    } else {
      navigate(-1);
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
        <IconButton aria-label="close" onClick={handleClose}>
          <CloseIcon />
        </IconButton>
        <Typography variant="h6">New Message</Typography>
      </Box>
      <Button variant="contained" color="primary" onClick={onSend}>
        Send
      </Button>
    </Box>
  );
};

export default ComposeHeader;
