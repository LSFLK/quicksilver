import React from "react";
import {
  BottomNavigation,
  BottomNavigationAction,
  Paper,
  Badge,
} from "@mui/material";
import { useNavigate, useLocation } from "react-router-dom";
import InboxIcon from "@mui/icons-material/Inbox";
import SendIcon from "@mui/icons-material/Send";
import DraftsIcon from "@mui/icons-material/Drafts";
import DeleteIcon from "@mui/icons-material/Delete";
import { useData } from "../../nonview/core/DataContext";

const MobileNavBar = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { unreadCount } = useData();

  const navItems = [
    { label: "Inbox", path: "/inbox", icon: InboxIcon, badge: unreadCount },
    { label: "Sent", path: "/sent", icon: SendIcon },
    { label: "Drafts", path: "/drafts", icon: DraftsIcon },
    { label: "Trash", path: "/trash", icon: DeleteIcon },
  ];

  return (
    <Paper
      sx={{ position: "fixed", bottom: 0, left: 0, right: 0, zIndex: 1000 }}
      elevation={3}
    >
      <BottomNavigation
        value={location.pathname}
        onChange={(event, newValue) => {
          navigate(newValue);
        }}
        showLabels
      >
        {navItems.map((item) => {
          const Icon = item.icon;
          const badgeCount =
            typeof item.badge === "number" ? item.badge : undefined;
          return (
            <BottomNavigationAction
              key={item.path}
              label={item.label}
              value={item.path}
              icon={
                badgeCount ? (
                  <Badge badgeContent={badgeCount} color="primary">
                    <Icon />
                  </Badge>
                ) : (
                  <Icon />
                )
              }
            />
          );
        })}
      </BottomNavigation>
    </Paper>
  );
};

export default MobileNavBar;
