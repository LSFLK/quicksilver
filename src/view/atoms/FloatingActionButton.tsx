import React from "react";
import { Fab } from "@mui/material";

const FloatingActionButton = ({
  icon: Icon,
  onClick,
  ariaLabel,
  color = "primary",
}) => {
  const renderIcon = () => {
    if (!Icon) return null;
    if (React.isValidElement(Icon)) return Icon;
    if (typeof Icon === "function" || typeof Icon === "object") {
      return React.createElement(Icon);
    }
    return null;
  };

  return (
    <Fab
      color={color}
      aria-label={ariaLabel}
      onClick={onClick}
      sx={{
        position: "fixed",
        bottom: 80,
        right: 16,
        display: { xs: "flex", md: "none" },
      }}
    >
      {renderIcon()}
    </Fab>
  );
};

export default FloatingActionButton;
