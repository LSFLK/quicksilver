import React from "react";
import { Box, Button } from "@mui/material";
import { useNavigate } from "react-router-dom";
import LogoutIcon from "@mui/icons-material/Logout";
import { useAuth } from "../../nonview/core/AuthContext";
import AppLayout from "../moles/AppLayout";
import ProfileHeader from "../moles/ProfileHeader";
import ProfileForm from "../moles/ProfileForm";

function ProfilePage() {
  const { currentUser, updateProfile, logout } = useAuth();
  const navigate = useNavigate();

  const handleUpdateProfile = async (updateData) => {
    await updateProfile(updateData);
  };

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  return (
    <AppLayout>
      <Box sx={{ pb: 4 }}>
        <ProfileHeader user={currentUser} />
        <ProfileForm user={currentUser} onSubmit={handleUpdateProfile} />
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
