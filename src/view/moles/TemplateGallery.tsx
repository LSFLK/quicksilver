import React from "react";
import { Box, Card, CardActionArea, Chip, Typography } from "@mui/material";
import { TEMPLATES, type EmailTemplate } from "../../nonview/email/templates";

interface TemplateGalleryProps {
  onSelect: (template: EmailTemplate) => void;
  selectedId?: string;
}

// Grid of template cards shown when the user is composing in template mode and
// hasn't picked one yet (or wants to switch). Selecting a card lifts the choice
// up to ComposePage.
const TemplateGallery: React.FC<TemplateGalleryProps> = ({ onSelect, selectedId }) => {
  return (
    <Box
      sx={{
        display: "grid",
        gridTemplateColumns: {
          xs: "1fr",
          sm: "repeat(2, 1fr)",
          md: "repeat(3, 1fr)",
        },
        gap: 2,
      }}
    >
      {TEMPLATES.map((t) => {
        const selected = t.id === selectedId;
        return (
          <Card
            key={t.id}
            variant="outlined"
            sx={{
              borderColor: selected ? "primary.main" : "divider",
              borderWidth: selected ? 2 : 1,
              borderRadius: 2,
              transition: "border-color 0.15s ease, box-shadow 0.15s ease",
              "&:hover": { boxShadow: 3, borderColor: "primary.light" },
            }}
          >
            <CardActionArea
              onClick={() => onSelect(t)}
              sx={{ p: 2, height: "100%", alignItems: "flex-start" }}
            >
              <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 1 }}>
                <Box sx={{ fontSize: 28, lineHeight: 1 }}>{t.icon}</Box>
                <Chip label={t.category} size="small" variant="outlined" />
              </Box>
              <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
                {t.name}
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                {t.description}
              </Typography>
            </CardActionArea>
          </Card>
        );
      })}
    </Box>
  );
};

export default TemplateGallery;
