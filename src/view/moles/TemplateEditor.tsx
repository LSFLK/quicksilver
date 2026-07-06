import React from "react";
import { Box, Button, InputAdornment, TextField, Typography } from "@mui/material";
import SwapHorizIcon from "@mui/icons-material/SwapHoriz";
import TemplatePreview from "./TemplatePreview";
import type { EmailTemplate, TemplateField, TemplateValues } from "../../nonview/email/templates";

interface TemplateEditorProps {
  template: EmailTemplate;
  values: TemplateValues;
  onChange: (key: string, value: string) => void;
  onChangeTemplate: () => void;
}

const FieldInput: React.FC<{
  field: TemplateField;
  value: string;
  onChange: (v: string) => void;
}> = ({ field, value, onChange }) => {
  const isMarkdown = field.type === "markdown";
  const multiline = field.type === "textarea" || field.type === "list" || isMarkdown;
  return (
    <TextField
      label={field.label}
      value={value ?? ""}
      onChange={(e) => onChange(e.target.value)}
      placeholder={field.placeholder}
      helperText={field.help}
      fullWidth
      size="small"
      multiline={multiline}
      minRows={isMarkdown ? 12 : multiline ? 3 : undefined}
      maxRows={isMarkdown ? 24 : undefined}
      type={field.type === "url" ? "url" : "text"}
      InputProps={
        isMarkdown
          ? {
              sx: {
                fontFamily:
                  'ui-monospace, SFMono-Regular, Menlo, Monaco, "Courier New", monospace',
                fontSize: 13,
              },
            }
          :
        field.type === "color"
          ? {
              startAdornment: (
                <InputAdornment position="start">
                  <Box
                    sx={{
                      width: 16,
                      height: 16,
                      borderRadius: "3px",
                      backgroundColor: value || "#000",
                      border: 1,
                      borderColor: "divider",
                    }}
                  />
                </InputAdornment>
              ),
            }
          : undefined
      }
    />
  );
};

// The working surface for template mode: an editable field form on the left and
// a live HTML preview on the right (stacked on small screens). Keeps its own
// layout only; all state is owned by ComposePage.
const TemplateEditor: React.FC<TemplateEditorProps> = ({
  template,
  values,
  onChange,
  onChangeTemplate,
}) => {
  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
      <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
          <Box sx={{ fontSize: 22 }}>{template.icon}</Box>
          <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
            {template.name}
          </Typography>
        </Box>
        <Button
          size="small"
          startIcon={<SwapHorizIcon />}
          onClick={onChangeTemplate}
          sx={{ flexShrink: 0 }}
        >
          Change
        </Button>
      </Box>

      {/* Fields take the full width; short fields flow into a responsive grid
          while long inputs (markdown / textarea / list) span the whole row. */}
      <Box
        sx={{
          display: "grid",
          gridTemplateColumns: { xs: "1fr", sm: "repeat(2, 1fr)", md: "repeat(3, 1fr)" },
          gap: 2,
          alignItems: "start",
        }}
      >
        {template.fields.map((f) => {
          const fullWidth =
            f.type === "markdown" || f.type === "textarea" || f.type === "list";
          return (
            <Box key={f.key} sx={{ gridColumn: fullWidth ? "1 / -1" : "auto" }}>
              <FieldInput field={f} value={values[f.key]} onChange={(v) => onChange(f.key, v)} />
            </Box>
          );
        })}
      </Box>

      {/* Preview sits below the form on its own full-width row. */}
      <Box sx={{ height: { xs: 480, md: 620 } }}>
        <TemplatePreview templateId={template.id} values={values} />
      </Box>
    </Box>
  );
};

export default TemplateEditor;
