import React, { useEffect, useState } from "react";
import { Box, CircularProgress, ToggleButton, ToggleButtonGroup, Typography } from "@mui/material";
import DesktopWindowsOutlinedIcon from "@mui/icons-material/DesktopWindowsOutlined";
import PhoneIphoneOutlinedIcon from "@mui/icons-material/PhoneIphoneOutlined";
import { renderTemplate } from "../../nonview/email/renderTemplate";
import type { TemplateValues } from "../../nonview/email/templates";

interface TemplatePreviewProps {
  templateId: string;
  values: TemplateValues;
}

// Renders the selected template to HTML (off the render helper) and shows it
// inside a sandboxed iframe so the email's own styles can't leak into the app.
// Re-renders whenever the template or its values change, debounced lightly so
// typing stays smooth.
const TemplatePreview: React.FC<TemplatePreviewProps> = ({ templateId, values }) => {
  const [html, setHtml] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [device, setDevice] = useState<"desktop" | "mobile">("desktop");

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    const timer = setTimeout(() => {
      renderTemplate(templateId, values)
        .then(({ html }) => {
          if (!cancelled) {
            setHtml(html);
            setLoading(false);
          }
        })
        .catch(() => {
          if (!cancelled) setLoading(false);
        });
    }, 150);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [templateId, values]);

  return (
    <Box
      sx={{
        display: "flex",
        flexDirection: "column",
        height: "100%",
        border: 1,
        borderColor: "divider",
        borderRadius: 2,
        overflow: "hidden",
        backgroundColor: "#f4f4f5",
      }}
    >
      <Box
        sx={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          px: 1.5,
          py: 0.75,
          borderBottom: 1,
          borderColor: "divider",
          backgroundColor: "background.paper",
        }}
      >
        <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600 }}>
          Live preview
        </Typography>
        <ToggleButtonGroup
          size="small"
          exclusive
          value={device}
          onChange={(_, v) => v && setDevice(v)}
        >
          <ToggleButton value="desktop" aria-label="desktop preview">
            <DesktopWindowsOutlinedIcon fontSize="small" />
          </ToggleButton>
          <ToggleButton value="mobile" aria-label="mobile preview">
            <PhoneIphoneOutlinedIcon fontSize="small" />
          </ToggleButton>
        </ToggleButtonGroup>
      </Box>

      <Box sx={{ position: "relative", flex: 1, overflow: "auto", p: device === "mobile" ? 2 : 0 }}>
        {loading && (
          <Box
            sx={{
              position: "absolute",
              inset: 0,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              pointerEvents: "none",
              zIndex: 1,
            }}
          >
            <CircularProgress size={22} />
          </Box>
        )}
        <Box
          sx={{
            mx: "auto",
            height: "100%",
            width: device === "mobile" ? 390 : "100%",
            maxWidth: device === "mobile" ? 390 : "none",
            transition: "width 0.2s ease",
          }}
        >
          <iframe
            title="Email preview"
            srcDoc={html}
            sandbox=""
            style={{
              width: "100%",
              height: "100%",
              minHeight: 480,
              border: "none",
              backgroundColor: "#f4f4f5",
            }}
          />
        </Box>
      </Box>
    </Box>
  );
};

export default TemplatePreview;
