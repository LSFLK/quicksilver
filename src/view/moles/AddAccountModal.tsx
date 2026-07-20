import { useState } from "react";
import { Dialog, DialogTitle, DialogContent, Divider, IconButton, Box, Typography, useMediaQuery, useTheme } from "@mui/material";
import CloseIcon from "@mui/icons-material/Close";
import { useAccount } from "../../nonview/core/AccountContext";
import { openAccountInNewTab } from "../../nonview/core/openAccountInNewTab";
import AddAccountForm from "./AddAccountForm";
import type { LinkedAccount } from "../../nonview/core/accountStorage";

interface AddAccountModalProps {
  open: boolean;
  onClose: () => void;
}

const AddAccountModal = ({ open, onClose }: AddAccountModalProps) => {
  const theme = useTheme();
  // This media query is to check whether the screen size is small (mobile) or not.
  // (whether to display the dialog in full-screen mode or not)
  const fullScreen = useMediaQuery(theme.breakpoints.down("md"));
  const { addAccount } = useAccount();
  const [step, setStep] = useState<1 | 2 | "success">(1);

  // Fires synchronously from the button click (no await)
  const handleSuccess = (account: LinkedAccount) => {
    openAccountInNewTab(account.id);
    onClose();
  };

  return (
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
        <Typography variant="subtitle1" sx={{ fontWeight: 600, flex: 1 }}>
          Add Account
        </Typography>
        <IconButton onClick={onClose} aria-label="close">
          <CloseIcon />
        </IconButton>
      </DialogTitle>

      <Divider sx={{ flexShrink: 0 }} />

      <DialogContent sx={{ flex: 1, overflowY: "auto" }}>
        {step === 1 && (
          <Box sx={{ display: "flex", flexDirection: "column", alignItems: "center", mb: 1 }}>
            <Box
              component="img"
              src={`${import.meta.env.BASE_URL}logo192.png`}
              alt="Quicksilver Logo"
              sx={{ width: 64, height: 64, objectFit: "contain", mb: 1.5 }}
            />
            <Typography variant="h5" sx={{ fontWeight: 700 }}>
              Quicksilver
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Welcome to your unified inbox
            </Typography>
          </Box>
        )}

        <AddAccountForm
          onSubmit={addAccount}
          onSuccess={handleSuccess}
          successCtaLabel="Open in new tab"
          onStepChange={setStep}
        />
      </DialogContent>
    </Dialog>
  );
};

export default AddAccountModal;
