import React, { useState } from "react";
import { Box, Container, Typography, Link } from "@mui/material";
import { useNavigate, Link as RouterLink } from "react-router-dom";
import { useAuth } from "../../nonview/core/AuthContext";
import LoginForm from "../moles/LoginForm";

function LoginPage() {
  const navigate = useNavigate();
  const { login } = useAuth();
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (data) => {
    setLoading(true);
    try {
      await login(data.email, data.password);
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
        <Box
          component="img"
          src={`${import.meta.env.BASE_URL}logo192.png`}
          alt="Quicksilver Logo"
          sx={{
            width: 120,
            height: 120,
            mb: 2,
            objectFit: "contain",
          }}
        />
        <Typography component="h1" variant="h3" sx={{ mb: 1, fontWeight: 600 }}>
          Quicksilver
        </Typography>
        <Typography component="h2" variant="h5" sx={{ mb: 3 }}>
          Sign in to your account
        </Typography>

        <LoginForm onSubmit={handleSubmit} loading={loading} />

        <Box
          sx={{
            mt: 2,
            display: "flex",
            gap: 2,
            flexWrap: "wrap",
            justifyContent: "center",
          }}
        >
          <Link component={RouterLink} to="/forgot-password" variant="body2">
            Forgot password?
          </Link>
          <Typography variant="body2" color="text.secondary">
            •
          </Typography>
          <Link component={RouterLink} to="/register" variant="body2">
            Don't have an account? Sign up
          </Link>
        </Box>
      </Box>
    </Container>
  );
}

export default LoginPage;
