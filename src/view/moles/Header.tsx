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
import { useAuth } from "../../nonview/core/AuthContext";
import { getInitials } from "../_constants/avatarUtils";
import SearchBar from "./SearchBar";

const Header = ({
  title,
  titleIcon,
  showBack = false,
  onMenuClick,
  actions = [],
  showSearch = false,
  onSearch,
}) => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("md"));
  const navigate = useNavigate();
  const { currentUser } = useAuth();

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
      <Toolbar>
        {/* Title */}
        <Box
          sx={{
            display: "flex",
            alignItems: "center",
            flexGrow: showSearch ? 0 : 1,
          }}
        >
          {TitleIcon && <TitleIcon sx={{ mr: 1, color: "text.secondary" }} />}
          <Typography variant="h6" component="h1">
            {title}
          </Typography>
        </Box>

        {/* Search Bar */}
        {showSearch && (
          <Box sx={{ flexGrow: 1, mx: 2, maxWidth: 600 }}>
            <SearchBar onSearch={onSearch} placeholder="Search emails..." />
          </Box>
        )}

        {/* Action Buttons */}
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

        {/* Profile Avatar (Mobile Only) */}
        {isMobile && (
          <IconButton
            onClick={() => navigate("/profile")}
            aria-label="profile"
            sx={{ ml: 1 }}
          >
            <Avatar
              sx={{
                width: 32,
                height: 32,
                fontSize: "0.875rem",
                bgcolor: "primary.main",
              }}
            >
              {getInitials(currentUser?.name || "User")}
            </Avatar>
          </IconButton>
        )}
      </Toolbar>
    </AppBar>
  );
};

export default Header;
