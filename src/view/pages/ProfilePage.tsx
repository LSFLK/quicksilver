import React from "react";
import { Box, Button } from "@mui/material";
import { useNavigate } from "react-router-dom";
import LogoutIcon from "@mui/icons-material/Logout";
import { useAccount } from "../../nonview/core/AccountContext";
import AppLayout from "../moles/AppLayout";
import ProfileHeader from "../moles/ProfileHeader";
import ProfileForm from "../moles/ProfileForm";

function ProfilePage() {
  const { activeAccount, updateAccount, signOut } = useAccount();
  const navigate = useNavigate();

  const handleUpdateProfile = async (updateData) => {
    if (!activeAccount) return;
    updateAccount(activeAccount.id, updateData);
  };

  const handleLogout = async () => {
    if (activeAccount) await signOut(activeAccount.id);
    navigate("/login");
  };

  return (
    <AppLayout>
      <Box sx={{ pb: 4 }}>
        <ProfileHeader user={activeAccount} />
        <ProfileForm user={activeAccount} onSubmit={handleUpdateProfile} />
        <Box sx={{ maxWidth: 500, mx: "auto", px: 2, mt: 4 }}>
          <Button
            variant="outlined"
            color="error"
            fullWidth
            startIcon={<LogoutIcon />}
            onClick={handleLogout}
          >
            Sign Out
          </Button>
        </Box>
      </Box>
    </AppLayout>
  );
}

export default ProfilePage;
