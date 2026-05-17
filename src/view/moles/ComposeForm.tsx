import React, { useRef } from "react";
import { Box, TextField } from "@mui/material";
import RecipientInput from "./RecipientInput";
import ComposeActions from "./ComposeActions";

const ComposeForm = ({
  recipients,
  onRecipientsChange,
  recipientInputRef,
  subject,
  onSubjectChange,
  body,
  onBodyChange,
  onAttachFiles,
  onSaveDraft,
  onDiscard,
  contacts,
}) => {
  const fileInputRef = useRef(null);

  const handleAttachClick = () => {
    if (fileInputRef.current) {
      fileInputRef.current.click();
    }
  };

  const handleFilesSelected = (e) => {
    const files = Array.from(e.target.files || []);
    if (files.length > 0 && onAttachFiles) {
      onAttachFiles(files);
    }
    e.target.value = "";
  };

  return (
    <Box sx={{ p: 2 }}>
      <RecipientInput
        ref={recipientInputRef}
        value={recipients}
        onChange={onRecipientsChange}
        suggestions={contacts}
      />

      <Box sx={{ mt: 2 }}>
        <TextField
          label="Subject"
          value={subject}
          onChange={(e) => onSubjectChange(e.target.value)}
          placeholder="Subject"
          fullWidth
          variant="outlined"
        />
      </Box>

      <Box sx={{ mt: 2 }}>
        <TextField
          value={body}
          onChange={(e) => onBodyChange(e.target.value)}
          placeholder="Write your message..."
          fullWidth
          variant="outlined"
          multiline
          minRows={10}
          maxRows={20}
        />
      </Box>

      <ComposeActions
        onAttach={handleAttachClick}
        onSaveDraft={onSaveDraft}
        onDiscard={onDiscard}
      />

      <input
        ref={fileInputRef}
        type="file"
        multiple
        style={{ display: "none" }}
        onChange={handleFilesSelected}
      />
    </Box>
  );
};

export default ComposeForm;
