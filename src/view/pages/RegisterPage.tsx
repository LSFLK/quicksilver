import React, { useState } from "react";
import { Box, Container, Typography, Link } from "@mui/material";
import { useNavigate, Link as RouterLink } from "react-router-dom";
import { useAuth } from "../../nonview/core/AuthContext";
import RegistrationForm from "../moles/RegistrationForm";

function RegisterPage() {
  const navigate = useNavigate();
  const { register } = useAuth();
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (data) => {
    setLoading(true);
    try {
      await register(data);
      navigate("/inbox");
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
        <Typography component="h2" variant="h5" sx={{ mb: 3 }}>
          Create your account
        </Typography>

        <RegistrationForm onSubmit={handleSubmit} loading={loading} />

        <Box sx={{ mt: 2 }}>
          <Link component={RouterLink} to="/login" variant="body2">
            Already have an account? Sign in
          </Link>
        </Box>
      </Box>
    </Container>
  );
}

export default RegisterPage;
