import React from "react";
import {
  AppBar,
  Toolbar,
  Typography,
  Box,
  useMediaQuery,
  useTheme,
  IconButton,
  Avatar,
} from "@mui/material";
import { useNavigate } from "react-router-dom";
import { useAccount } from "../../nonview/core/AccountContext";
import { getInitials } from "../_constants/avatarUtils";
import SearchBar from "./SearchBar";

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
  const navigate = useNavigate();
  const { activeAccount } = useAccount();

  const TitleIcon = titleIcon;

  return (
    <AppBar
      position="static"
      color="default"
      elevation={0}
      sx={{
        borderBottom: 1,
        borderColor: "divider",
        backgroundColor: "background.paper",
      }}
    >
      <Toolbar sx={{ justifyContent: "space-between" }}>
        {/* Title */}
        <Box
          sx={{
            display: "flex",
            alignItems: "center",
            flex: 1,
          }}
        >
          {TitleIcon && <TitleIcon sx={{ mr: 1, color: "text.secondary" }} />}
          <Typography variant="h6" component="h1">
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
          }}
        >
          {actions.map((action, index) => {
            const ActionIcon = action.icon;
            return (
              <IconButton
                key={index}
                onClick={action.onClick}
                aria-label={action.label}
              >
                <ActionIcon />
              </IconButton>
            );
          })}

          <IconButton
            onClick={() => navigate("/profile")}
            aria-label="profile"
            sx={{ ml: isMobile ? 1 : 2 }}
          >
            <Avatar
              sx={{
                width: 32,
                height: 32,
                fontSize: "0.875rem",
                bgcolor: "primary.main",
              }}
            >
              {getInitials(activeAccount?.name || "User")}
            </Avatar>
          </IconButton>
        </Box>
      </Toolbar>
    </AppBar>
  );
};

export default Header;
