import React from "react";
import {
  AppBar,
  Toolbar,
  Typography,
  Box,
  useMediaQuery,
  useTheme,
  IconButton,
  Tooltip,
} from "@mui/material";
import SearchBar from "./SearchBar";
import AccountSwitcher from "./AccountSwitcher";

const Header = ({
  title,
  titleIcon,
  showBack = false,
  onMenuClick = null,
  actions = [],
  showSearch = false,
  onSearch,
}) => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("md"));

  const TitleIcon = titleIcon;

  return (
    <AppBar
      position="static"
      color="default"
      elevation={0}
      sx={(muiTheme) => ({
        borderBottom: 1,
        borderColor: "divider",
        // Frosted HUD bar (DESIGN.md, Elevation & Depth).
        backgroundColor: "rgba(247, 249, 251, 0.8)",
        backdropFilter: "blur(20px)",
        ...muiTheme.applyStyles("dark", {
          backgroundColor: "rgba(19, 19, 20, 0.8)",
        }),
      })}
    >
      <Toolbar sx={{ justifyContent: "space-between", minHeight: { xs: 56, md: 60 }, gap: 1 }}>
        {/* Wordmark */}
        <Box
          sx={{
            display: "flex",
            alignItems: "center",
            gap: 1.25,
            flex: 1,
            minWidth: 0,
          }}
        >
          {TitleIcon && (
            <Box
              sx={{
                width: 34,
                height: 34,
                borderRadius: 2.5,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                flexShrink: 0,
                color: "primary.main",
                backgroundColor: "action.selected",
              }}
            >
              <TitleIcon sx={{ fontSize: 20 }} />
            </Box>
          )}
          <Typography
            variant="h6"
            component="h1"
            noWrap
            sx={{ letterSpacing: "-0.02em" }}
          >
            {title}
          </Typography>
        </Box>

        {/* Search Bar */}
        {showSearch && (
          <Box sx={{ flex: 2, display: "flex", justifyContent: "center", mx: 2 }}>
            <Box sx={{ width: "100%", maxWidth: 600 }}>
              <SearchBar onSearch={onSearch} placeholder="Search emails..." />
            </Box>
          </Box>
        )}

        {/* Action Buttons */}
        <Box
          sx={{
            display: "flex",
            alignItems: "center",
            justifyContent: "flex-end",
            flex: 1,
            gap: 0.5,
          }}
        >
          {actions.map((action, index) => {
            const ActionIcon = action.icon;
            return (
              <Tooltip key={index} title={action.label || ""}>
                <IconButton
                  onClick={action.onClick}
                  aria-label={action.label}
                  sx={{ color: "text.secondary" }}
                >
                  <ActionIcon />
                </IconButton>
              </Tooltip>
            );
          })}

          <Box sx={{ ml: isMobile ? 0.5 : 1 }}>
            <AccountSwitcher />
          </Box>
        </Box>
      </Toolbar>
    </AppBar>
  );
};

export default Header;
