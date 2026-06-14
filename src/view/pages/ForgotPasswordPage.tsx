import React, { useState } from "react";
import { Box, Container, Typography, Link } from "@mui/material";
import { Link as RouterLink } from "react-router-dom";
import { useAuth } from "../../nonview/core/AuthContext";
import PasswordResetForm from "../moles/PasswordResetForm";

function ForgotPasswordPage() {
  const { resetPassword } = useAuth();
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (data) => {
    setLoading(true);
    try {
      await resetPassword(data.email);
    } catch (error) {
      throw error;
    } finally {
      setLoading(false);
    }
  };

  return (
    <Container maxWidth="sm">
      <Box
        sx={{
          marginTop: 8,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
        }}
      >
        <Typography component="h1" variant="h3" sx={{ mb: 1, fontWeight: 600 }}>
          Quicksilver
        </Typography>
        <Typography component="h2" variant="h5" sx={{ mb: 1 }}>
          Reset your password
        </Typography>
        <Typography
          variant="body2"
          color="text.secondary"
          sx={{ mb: 3, textAlign: "center" }}
        >
          Enter your email address and we'll send you instructions to reset your
          password.
        </Typography>

        <PasswordResetForm onSubmit={handleSubmit} loading={loading} />

        <Box sx={{ mt: 2 }}>
          <Link component={RouterLink} to="/login" variant="body2">
            Back to sign in
          </Link>
        </Box>
      </Box>
    </Container>
  );
}

export default ForgotPasswordPage;
