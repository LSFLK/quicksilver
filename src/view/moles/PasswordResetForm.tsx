import React, { useState } from "react";
import { Box, TextField, Button, CircularProgress } from "@mui/material";
import ErrorMessage from "../atoms/ErrorMessage";

const PasswordResetForm = ({ onSubmit, loading = false }) => {
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [formError, setFormError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  const validateEmail = () => {
    if (!email) {
      setError("Email is required");
      return false;
    }
    if (!/\S+@\S+\.\S+/.test(email)) {
      setError("Email is invalid");
      return false;
    }
    setError("");
    return true;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setFormError("");
    setSuccessMessage("");

    if (!validateEmail()) {
      return;
    }

    try {
      await onSubmit({ email });
      setSuccessMessage(
        "Password reset instructions have been sent to your email address.",
      );
      setEmail("");
    } catch (error) {
      setFormError(
        error.message || "Failed to send reset email. Please try again.",
      );
    }
  };

  return (
    <Box component="form" onSubmit={handleSubmit} sx={{ mt: 1, width: "100%" }}>
      {formError && (
        <Box sx={{ mb: 2 }}>
          <ErrorMessage
            message={formError}
            onDismiss={() => setFormError("")}
          />
        </Box>
      )}

      {successMessage && (
        <Box sx={{ mb: 2 }}>
          <ErrorMessage
            message={successMessage}
            severity="success"
            onDismiss={() => setSuccessMessage("")}
          />
        </Box>
      )}

      <TextField
        label="Email Address"
        type="email"
        value={email}
        onChange={(e) => {
          setEmail(e.target.value);
          if (error) setError("");
        }}
        error={!!error}
        helperText={error}
        autoComplete="email"
        required
        fullWidth
        variant="outlined"
        sx={{ mb: 2 }}
      />

      <Button
        type="submit"
        fullWidth
        disabled={loading}
        variant="contained"
        color="primary"
        startIcon={loading ? <CircularProgress size={20} /> : null}
        sx={{ mt: 3, mb: 2 }}
      >
        Send Reset Link
      </Button>
    </Box>
  );
};

export default PasswordResetForm;
