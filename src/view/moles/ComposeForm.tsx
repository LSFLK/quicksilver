import React, { useRef } from "react";
import { Box, TextField, ToggleButton, ToggleButtonGroup } from "@mui/material";
import NotesIcon from "@mui/icons-material/Notes";
import DashboardCustomizeOutlinedIcon from "@mui/icons-material/DashboardCustomizeOutlined";
import RecipientInput from "./RecipientInput";
import ComposeActions from "./ComposeActions";
import TemplateGallery from "./TemplateGallery";
import TemplateEditor from "./TemplateEditor";
import { getTemplate } from "../../nonview/email/templates";

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
  // Template mode
  mode,
  onModeChange,
  templateId,
  templateValues,
  onTemplateSelect,
  onTemplateValueChange,
  onChangeTemplate,
}) => {
  const fileInputRef = useRef(null);
  const selectedTemplate = templateId ? getTemplate(templateId) : undefined;

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

      <Box sx={{ mt: 2, display: "flex", justifyContent: "flex-end" }}>
        <ToggleButtonGroup
          size="small"
          exclusive
          value={mode}
          onChange={(_, v) => v && onModeChange(v)}
          aria-label="compose mode"
        >
          <ToggleButton value="plaintext" aria-label="plain text">
            <NotesIcon fontSize="small" sx={{ mr: 0.5 }} />
            Plain text
          </ToggleButton>
          <ToggleButton value="template" aria-label="template">
            <DashboardCustomizeOutlinedIcon fontSize="small" sx={{ mr: 0.5 }} />
            Template
          </ToggleButton>
        </ToggleButtonGroup>
      </Box>

      {mode === "template" ? (
        <Box sx={{ mt: 2 }}>
          {selectedTemplate ? (
            <TemplateEditor
              template={selectedTemplate}
              values={templateValues}
              onChange={onTemplateValueChange}
              onChangeTemplate={onChangeTemplate}
            />
          ) : (
            <TemplateGallery onSelect={onTemplateSelect} selectedId={templateId} />
          )}
        </Box>
      ) : (
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
      )}

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
