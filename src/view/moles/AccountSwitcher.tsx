import React, { useState } from "react";
import {
  IconButton,
  Avatar,
  Menu,
  MenuItem,
  Button,
  Typography,
  Box,
  Divider,
  Collapse,
  Badge,
} from "@mui/material";
import { alpha } from "@mui/material/styles";
import CloseIcon from "@mui/icons-material/Close";
import CameraAltOutlinedIcon from "@mui/icons-material/CameraAltOutlined";
import AddIcon from "@mui/icons-material/Add";
import LogoutOutlinedIcon from "@mui/icons-material/LogoutOutlined";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import ExpandLessIcon from "@mui/icons-material/ExpandLess";
import { useAccount } from "../../nonview/core/AccountContext";
import { useData } from "../../nonview/core/DataContext";
import { openAccountInNewTab } from "../../nonview/core/openAccountInNewTab";
import { getInitials, getAvatarColor } from "../_constants/avatarUtils";
import ManageAccountDialog from "./ManageAccountDialog";
import AddAccountModal from "./AddAccountModal";
import ConfirmDialog from "../atoms/ConfirmDialog";

const AccountSwitcher = () => {
  const { activeAccount, accounts, logoutAll } = useAccount();
  const { unreadCount } = useData();

  const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null);
  const [othersOpen, setOthersOpen] = useState(true);
  const [manageOpen, setManageOpen] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [signOutOpen, setSignOutOpen] = useState(false);
  const [signingOut, setSigningOut] = useState(false);

  if (!activeAccount) return null;

  const otherAccounts = accounts.filter((a) => a.id !== activeAccount.id);

  const closeMenu = () => setAnchorEl(null);

  const openManage = () => {
    closeMenu();
    setManageOpen(true);
  };

  const handleSignOutAll = async () => {
    setSigningOut(true);
    await logoutAll();
    setSigningOut(false);
    setSignOutOpen(false);
  };

  return (
    <>
      <IconButton onClick={(e) => setAnchorEl(e.currentTarget)} aria-label="account menu">
        <Badge color="error" badgeContent={unreadCount} max={99}>
          <Avatar
            sx={{
              width: 32,
              height: 32,
              fontSize: "0.875rem",
              bgcolor: "primary.main",
              color: "primary.contrastText",
            }}
          >
            {getInitials(activeAccount.name)}
          </Avatar>
        </Badge>
      </IconButton>

      <Menu
        open={!!anchorEl}
        anchorEl={anchorEl}
        onClose={closeMenu}
        slotProps={{ paper: { sx: { width: 340, maxWidth: "calc(100vw - 24px)", borderRadius: "20px" } } }}
      >
        <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", px: 2, pt: 1 }}>
          <Typography variant="body2" color="text.secondary" noWrap>
            {activeAccount.email}
          </Typography>
          <IconButton size="small" onClick={closeMenu} aria-label="close">
            <CloseIcon fontSize="small" />
          </IconButton>
        </Box>

        <Box sx={{ display: "flex", flexDirection: "column", alignItems: "center", px: 2, pb: 2 }}>
          <Box sx={{ position: "relative", mt: 1, mb: 2 }}>
            <Avatar
              sx={{
                width: 72,
                height: 72,
                fontSize: "1.5rem",
                ...getAvatarColor(activeAccount.name),
              }}
            >
              {getInitials(activeAccount.name)}
            </Avatar>
            <Box
              sx={{
                position: "absolute",
                bottom: 0,
                right: 0,
                width: 28,
                height: 28,
                borderRadius: "50%",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                bgcolor: "background.paper",
                border: "1px solid",
                borderColor: "divider",
                boxShadow: "0 1px 4px rgba(0, 0, 0, 0.2)",
              }}
            >
              <CameraAltOutlinedIcon sx={{ fontSize: 14, color: "text.secondary" }} />
            </Box>
          </Box>

          <Typography variant="h6" sx={{ fontWeight: 700 }}>
            Hi, {activeAccount.name.split(" ")[0]}!
          </Typography>
          {unreadCount > 0 && (
            <Typography variant="body2" sx={{ color: "primary.main", fontWeight: 600, mt: 0.5 }}>
              {unreadCount} unread message{unreadCount === 1 ? "" : "s"}
            </Typography>
          )}

          <Button variant="outlined" onClick={openManage} sx={{ borderRadius: 999, mt: 2, px: 3 }}>
            Manage your Account
          </Button>
        </Box>

        <Divider />

        {otherAccounts.length > 0 && (
          <>
            <MenuItem
              onClick={() => setOthersOpen((prev) => !prev)}
              sx={{ justifyContent: "space-between" }}
            >
              <Typography variant="body2" sx={{ flex: 1 }}>
                {othersOpen ? "Hide more accounts" : "Show more accounts"}
              </Typography>
              {othersOpen ? <ExpandLessIcon fontSize="small" /> : <ExpandMoreIcon fontSize="small" />}
            </MenuItem>
            <Collapse in={othersOpen}>
              {otherAccounts.map((account) => (
                <MenuItem
                  key={account.id}
                  onClick={() => {
                    closeMenu();
                    openAccountInNewTab(account.id);
                  }}
                  sx={{ gap: 1.5, py: 1 }}
                >
                  <Avatar sx={{ width: 40, height: 40, fontSize: "0.9rem", ...getAvatarColor(account.name) }}>
                    {getInitials(account.name)}
                  </Avatar>
                  <Box sx={{ minWidth: 0 }}>
                    <Typography variant="body2" sx={{ fontWeight: 600 }} noWrap>
                      {account.name}
                    </Typography>
                    <Typography variant="caption" color="text.secondary" noWrap>
                      {account.email}
                    </Typography>
                  </Box>
                </MenuItem>
              ))}
            </Collapse>
          </>
        )}

        <MenuItem
          onClick={() => {
            closeMenu();
            setAddOpen(true);
          }}
          sx={{ gap: 1.5 }}
        >
          <Box
            sx={{
              width: 40,
              height: 40,
              borderRadius: "50%",
              border: "1.5px dashed",
              borderColor: "divider",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flexShrink: 0,
            }}
          >
            <AddIcon fontSize="small" />
          </Box>
          <Typography variant="body2" sx={{ flex: 1 }}>
            Add another account
          </Typography>
        </MenuItem>

        <Divider />

        <MenuItem
          onClick={() => {
            closeMenu();
            setSignOutOpen(true);
          }}
          sx={{ gap: 1.5, color: "error.main" }}
        >
          <Box
            sx={(theme) => ({
              width: 32,
              height: 32,
              borderRadius: "50%",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flexShrink: 0,
              bgcolor: alpha(theme.palette.error.main, 0.12),
            })}
          >
            <LogoutOutlinedIcon fontSize="small" color="error" />
          </Box>
          <Typography variant="body2" sx={{ flex: 1 }}>
            Sign out of all accounts
          </Typography>
        </MenuItem>
      </Menu>

      <ManageAccountDialog open={manageOpen} onClose={() => setManageOpen(false)} />
      <AddAccountModal open={addOpen} onClose={() => setAddOpen(false)} />
      <ConfirmDialog
        open={signOutOpen}
        title="Sign out of all accounts?"
        message="You'll need to sign in again to use Quicksilver."
        confirmLabel="Sign out"
        confirmColor="error"
        loading={signingOut}
        onConfirm={handleSignOutAll}
        onCancel={() => setSignOutOpen(false)}
      />
    </>
  );
};

export default AccountSwitcher;
