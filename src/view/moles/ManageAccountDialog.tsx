import React, { useState } from "react";
import {
  Dialog,
  DialogTitle,
  DialogContent,
  IconButton,
  List,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Box,
  Avatar,
  TextField,
  Button,
  Divider,
  Typography,
  Link,
  useMediaQuery,
  useTheme,
} from "@mui/material";
import { useColorScheme } from "@mui/material/styles";
import CloseIcon from "@mui/icons-material/Close";
import PersonOutlineIcon from "@mui/icons-material/PersonOutline";
import PaletteOutlinedIcon from "@mui/icons-material/PaletteOutlined";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import ChevronRightIcon from "@mui/icons-material/ChevronRight";
import { useAccount } from "../../nonview/core/AccountContext";
import { getInitials } from "../_constants/avatarUtils";
import ErrorMessage from "../atoms/ErrorMessage";
import ConfirmDialog from "../atoms/ConfirmDialog";

interface ManageAccountDialogProps {
  open: boolean;
  onClose: () => void;
}

const THEME_OPTIONS = ["light", "dark"] as const;
const NAV_ITEMS = [
  { key: "profile", label: "Profile", icon: PersonOutlineIcon },
  { key: "appearance", label: "Appearance", icon: PaletteOutlinedIcon },
] as const;

const ManageAccountDialog = ({ open, onClose }: ManageAccountDialogProps) => {
  const theme = useTheme();
  const fullScreen = useMediaQuery(theme.breakpoints.down("md"));
  const { activeAccount, updateAccount, removeAccount } = useAccount();
  const { mode, systemMode, setMode } = useColorScheme();
  const resolvedMode = (mode === "system" ? systemMode : mode) || "light";

  const [section, setSection] = useState<(typeof NAV_ITEMS)[number]["key"]>("profile");
  const [name, setName] = useState(activeAccount?.name || "");
  const [nameError, setNameError] = useState("");
  const [saved, setSaved] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [removing, setRemoving] = useState(false);

  if (!activeAccount) return null;

  const handleSave = () => {
    if (!name.trim()) {
      setNameError("Name is required");
      return;
    }
    updateAccount(activeAccount.id, { name: name.trim() });
    setSaved(true);
  };

  const handleRemove = async () => {
    setRemoving(true);
    await removeAccount(activeAccount.id);
    setRemoving(false);
    setConfirmOpen(false);
    onClose();
  };

  const filledFieldSx = {
    "& .MuiFilledInput-root": {
      borderRadius: 2,
      bgcolor: "action.hover",
      "&::before, &::after": { display: "none" },
    },
  };

  return (
    <>
      <Dialog
        open={open}
        onClose={onClose}
        fullScreen={fullScreen}
        keepMounted={false}
        slotProps={{
          paper: {
            sx: fullScreen
              ? undefined
              : {
                  width: 650,
                  height: 560,
                  maxWidth: "95vw",
                  maxHeight: "90vh",
                  display: "flex",
                  flexDirection: "column",
                },
          },
        }}
      >
        <DialogTitle sx={{ display: "flex", alignItems: "center", gap: 1.5, py: 2, flexShrink: 0 }}>
          <Avatar
            sx={{
              width: 40,
              height: 40,
              fontSize: "1rem",
              bgcolor: "primary.main",
              color: "primary.contrastText",
            }}
          >
            {getInitials(activeAccount.name)}
          </Avatar>
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Typography variant="subtitle1" sx={{ fontWeight: 600, lineHeight: 1.2 }} noWrap>
              {activeAccount.name}
            </Typography>
            <Typography variant="body2" color="text.secondary" noWrap>
              {activeAccount.email}
            </Typography>
          </Box>
          <IconButton onClick={onClose} aria-label="close">
            <CloseIcon />
          </IconButton>
        </DialogTitle>

        <Divider sx={{ flexShrink: 0 }} />

        <Box sx={{ display: "flex", flexDirection: fullScreen ? "column" : "row", flex: 1, minHeight: 0 }}>
          <List
            sx={
              fullScreen
                ? {
                    display: "flex",
                    flexDirection: "row",
                    width: "100%",
                    flexShrink: 0,
                    borderBottom: 1,
                    borderColor: "divider",
                    py: 1,
                  }
                : {
                    width: 200,
                    flexShrink: 0,
                    borderRight: 1,
                    borderColor: "divider",
                    py: 2,
                    overflowY: "auto",
                  }
            }
          >
            {NAV_ITEMS.map(({ key, label, icon: Icon }) => (
              <ListItemButton
                key={key}
                selected={section === key}
                onClick={() => setSection(key)}
                sx={fullScreen ? { flex: 1, justifyContent: "center", mx: 0.5, borderRadius: 1.5 } : { mx: 1, borderRadius: 1.5 }}
              >
                <ListItemIcon sx={{ minWidth: fullScreen ? 0 : 36, mr: fullScreen ? 1 : 0 }}>
                  <Icon fontSize="small" color={section === key ? "primary" : "inherit"} />
                </ListItemIcon>
                <ListItemText
                  primary={label}
                  sx={fullScreen ? { flexGrow: 0 } : undefined}
                  slotProps={{
                    primary: { color: section === key ? "primary" : "text.primary" },
                  }}
                />
              </ListItemButton>
            ))}
          </List>

          <DialogContent sx={{ flex: 1, overflowY: "auto" }}>
            {section === "profile" && (
              <Box sx={{ maxWidth: fullScreen ? "100%" : 420 }}>
                <Box sx={{ display: "flex", alignItems: "center", gap: 2, mb: 3 }}>
                  <Avatar
                    sx={{
                      width: 64,
                      height: 64,
                      fontSize: "1.5rem",
                      bgcolor: "primary.main",
                      color: "primary.contrastText",
                    }}
                  >
                    {getInitials(activeAccount.name)}
                  </Avatar>
                  <Box>
                    <Typography variant="body2" color="text.secondary">
                      Profile photo
                    </Typography>
                    {/* No avatar-upload backend yet — inert placeholder. */}
                    <Link component="button" type="button" variant="body2" underline="hover" disabled>
                      Change photo
                    </Link>
                  </Box>
                </Box>

                {saved && (
                  <Box sx={{ mb: 2 }}>
                    <ErrorMessage
                      message="Profile updated successfully"
                      variant="success"
                      onDismiss={() => setSaved(false)}
                    />
                  </Box>
                )}

                <TextField
                  label="Name"
                  fullWidth
                  variant="filled"
                  value={name}
                  onChange={(e) => {
                    setName(e.target.value);
                    setNameError("");
                    setSaved(false);
                  }}
                  error={!!nameError}
                  helperText={nameError}
                  sx={{ mb: 2, ...filledFieldSx }}
                />
                <TextField
                  label="Email Address"
                  fullWidth
                  variant="filled"
                  value={activeAccount.email}
                  disabled
                  sx={{ mb: 3, ...filledFieldSx }}
                />
                <Button
                  variant="contained"
                  onClick={handleSave}
                  disabled={!name.trim() || name.trim() === activeAccount.name}
                  sx={{ mb: 4 }}
                >
                  Save changes
                </Button>

                <Divider sx={{ mb: 2 }} />
                <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 1 }}>
                  Account management
                </Typography>
                <ListItemButton
                  disabled={removing}
                  onClick={() => setConfirmOpen(true)}
                  sx={{
                    border: 1,
                    borderColor: "divider",
                    borderRadius: 2,
                  }}
                >
                  <ListItemIcon sx={{ minWidth: 36 }}>
                    <DeleteOutlineIcon fontSize="small" />
                  </ListItemIcon>
                  <ListItemText primary="Remove this account" />
                  <ChevronRightIcon fontSize="small" color="action" />
                </ListItemButton>
              </Box>
            )}

            {section === "appearance" && (
              <Box sx={{ maxWidth: fullScreen ? "100%" : 420 }}>
                <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 2 }}>
                  Theme
                </Typography>
                <Box sx={{ display: "flex", gap: 2 }}>
                  {THEME_OPTIONS.map((option) => (
                    <Box
                      key={option}
                      onClick={() => setMode(option)}
                      sx={{
                        flex: 1,
                        cursor: "pointer",
                        border: 2,
                        borderColor: resolvedMode === option ? "primary.main" : "divider",
                        borderRadius: 2,
                        p: 2,
                        textAlign: "center",
                        bgcolor: option === "dark" ? "grey.900" : "grey.50",
                        color: option === "dark" ? "grey.50" : "grey.900",
                      }}
                    >
                      <Typography variant="body2" sx={{ textTransform: "capitalize" }}>
                        {option}
                      </Typography>
                    </Box>
                  ))}
                </Box>
              </Box>
            )}
          </DialogContent>
        </Box>
      </Dialog>

      <ConfirmDialog
        open={confirmOpen}
        title="Are you sure you want to remove this account?"
        message="You'll need to sign in again to add it later."
        confirmLabel="Remove"
        confirmColor="error"
        loading={removing}
        onConfirm={handleRemove}
        onCancel={() => setConfirmOpen(false)}
      />
    </>
  );
};

export default ManageAccountDialog;
