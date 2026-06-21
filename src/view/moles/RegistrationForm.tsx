import React, { useState } from "react";
import {
  Box,
  TextField,
  Button,
  CircularProgress,
  MenuItem,
  Typography,
  Divider,
} from "@mui/material";
import ErrorMessage from "../atoms/ErrorMessage";

// Email service provider configurations
// smtpSecure=true means implicit TLS (port 465); smtpSecure=false means
// STARTTLS on the submission port (587). Gmail/Outlook/Yahoo all support both
// — we default to 465+implicit-TLS because it's a single negotiation and works
// even when a network rewrites STARTTLS responses.
const EMAIL_PROVIDERS = {
  gmail: {
    name: "Gmail",
    imapHost: "imap.gmail.com",
    imapPort: 993,
    imapSecure: true,
    smtpHost: "smtp.gmail.com",
    smtpPort: 465,
    smtpSecure: true,
  },
  outlook: {
    name: "Outlook",
    imapHost: "outlook.office365.com",
    imapPort: 993,
    imapSecure: true,
    smtpHost: "smtp.office365.com",
    smtpPort: 587,
    smtpSecure: false,
  },
  yahoo: {
    name: "Yahoo Mail",
    imapHost: "imap.mail.yahoo.com",
    imapPort: 993,
    imapSecure: true,
    smtpHost: "smtp.mail.yahoo.com",
    smtpPort: 465,
    smtpSecure: true,
  },
  custom: {
    name: "Custom",
    imapHost: "",
    imapPort: 993,
    imapSecure: true,
    smtpHost: "",
    smtpPort: 465,
    smtpSecure: true,
  },
};

const RegistrationForm = ({ onSubmit, loading = false }) => {
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    password: "",
    confirmPassword: "",
    // Email service connection parameters
    emailServiceProvider: "gmail",
    emailAddress: "",
    emailPassword: "",
    imapHost: EMAIL_PROVIDERS.gmail.imapHost,
    imapPort: EMAIL_PROVIDERS.gmail.imapPort,
    imapSecure: EMAIL_PROVIDERS.gmail.imapSecure,
    smtpHost: EMAIL_PROVIDERS.gmail.smtpHost,
    smtpPort: EMAIL_PROVIDERS.gmail.smtpPort,
    smtpSecure: EMAIL_PROVIDERS.gmail.smtpSecure,
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState("");

  const handleChange = (field) => (e) => {
    const value = e.target.value;
    let updates: Record<string, any> = { [field]: value };

    // Auto-populate server settings when provider changes
    if (field === "emailServiceProvider" && EMAIL_PROVIDERS[value]) {
      const provider = EMAIL_PROVIDERS[value];
      updates = {
        ...updates,
        imapHost: provider.imapHost,
        imapPort: provider.imapPort,
        imapSecure: provider.imapSecure,
        smtpHost: provider.smtpHost,
        smtpPort: provider.smtpPort,
        smtpSecure: provider.smtpSecure,
      };
    }

    setFormData({ ...formData, ...updates });
    // Clear error for this field when user types
    if (errors[field]) {
      setErrors({ ...errors, [field]: "" });
    }
  };

  const validateForm = () => {
    const newErrors: Record<string, string> = {};

    if (!formData.name.trim()) {
      newErrors.name = "Name is required";
    }

    if (!formData.email) {
      newErrors.email = "Email is required";
    } else if (!/\S+@\S+\.\S+/.test(formData.email)) {
      newErrors.email = "Email is invalid";
    }

    if (!formData.password) {
      newErrors.password = "Password is required";
    } else if (formData.password.length < 6) {
      newErrors.password = "Password must be at least 6 characters";
    }

    if (!formData.confirmPassword) {
      newErrors.confirmPassword = "Please confirm your password";
    } else if (formData.password !== formData.confirmPassword) {
      newErrors.confirmPassword = "Passwords do not match";
    }

    // Email service validation
    if (!formData.emailAddress) {
      newErrors.emailAddress = "Email address for service is required";
    } else if (!/\S+@\S+\.\S+/.test(formData.emailAddress)) {
      newErrors.emailAddress = "Email address is invalid";
    }

    if (!formData.emailPassword) {
      newErrors.emailPassword = "Email service password is required";
    }

    if (!formData.imapHost) {
      newErrors.imapHost = "IMAP host is required";
    }

    if (!formData.smtpHost) {
      newErrors.smtpHost = "SMTP host is required";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setFormError("");

    if (!validateForm()) {
      return;
    }

    try {
      await onSubmit({
        name: formData.name,
        email: formData.email,
        password: formData.password,
        // Email service configuration
        emailServiceProvider: formData.emailServiceProvider,
        emailAddress: formData.emailAddress,
        emailPassword: formData.emailPassword,
        imapHost: formData.imapHost,
        imapPort: parseInt(String(formData.imapPort), 10),
        imapSecure: formData.imapSecure,
        smtpHost: formData.smtpHost,
        smtpPort: parseInt(String(formData.smtpPort), 10),
        smtpSecure: formData.smtpSecure,
      });
    } catch (error) {
      setFormError(error.message || "Registration failed. Please try again.");
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

      <TextField
        label="Full Name"
        type="text"
        value={formData.name}
        onChange={handleChange("name")}
        error={!!errors.name}
        helperText={errors.name}
        autoComplete="name"
        required
        fullWidth
        variant="outlined"
        sx={{ mb: 2 }}
      />

      <TextField
        label="Email Address"
        type="email"
        value={formData.email}
        onChange={handleChange("email")}
        error={!!errors.email}
        helperText={errors.email}
        autoComplete="email"
        required
        fullWidth
        variant="outlined"
        sx={{ mb: 2 }}
      />

      <TextField
        label="Password"
        type="password"
        value={formData.password}
        onChange={handleChange("password")}
        error={!!errors.password}
        helperText={errors.password}
        autoComplete="new-password"
        required
        fullWidth
        variant="outlined"
        sx={{ mb: 2 }}
      />

      <TextField
        label="Confirm Password"
        type="password"
        value={formData.confirmPassword}
        onChange={handleChange("confirmPassword")}
        error={!!errors.confirmPassword}
        helperText={errors.confirmPassword}
        autoComplete="new-password"
        required
        fullWidth
        variant="outlined"
        sx={{ mb: 2 }}
      />

      <Divider sx={{ my: 3 }} />
      <Typography variant="h6" gutterBottom>
        Email Service Configuration
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        Configure your email service connection (Gmail, Outlook, etc.)
      </Typography>

      <TextField
        select
        label="Email Service Provider"
        value={formData.emailServiceProvider}
        onChange={handleChange("emailServiceProvider")}
        required
        fullWidth
        variant="outlined"
        sx={{ mb: 2 }}
      >
        {Object.entries(EMAIL_PROVIDERS).map(([key, provider]) => (
          <MenuItem key={key} value={key}>
            {provider.name}
          </MenuItem>
        ))}
      </TextField>

      <TextField
        label="Email Address"
        type="email"
        value={formData.emailAddress}
        onChange={handleChange("emailAddress")}
        error={!!errors.emailAddress}
        helperText={
          errors.emailAddress ||
          "Your actual email address (e.g., yourname@gmail.com)"
        }
        required
        fullWidth
        variant="outlined"
        sx={{ mb: 2 }}
      />

      <TextField
        label="Email Password / App Password"
        type="password"
        value={formData.emailPassword}
        onChange={handleChange("emailPassword")}
        error={!!errors.emailPassword}
        helperText={
          errors.emailPassword ||
          "For Gmail/Outlook, use an app-specific password"
        }
        required
        fullWidth
        variant="outlined"
        sx={{ mb: 2 }}
      />

      {formData.emailServiceProvider === "custom" && (
        <>
          <Typography variant="subtitle2" sx={{ mt: 2, mb: 1 }}>
            IMAP Settings (Incoming Mail)
          </Typography>
          <TextField
            label="IMAP Host"
            type="text"
            value={formData.imapHost}
            onChange={handleChange("imapHost")}
            error={!!errors.imapHost}
            helperText={errors.imapHost}
            required
            fullWidth
            variant="outlined"
            sx={{ mb: 2 }}
          />
          <TextField
            label="IMAP Port"
            type="number"
            value={formData.imapPort}
            onChange={handleChange("imapPort")}
            required
            fullWidth
            variant="outlined"
            sx={{ mb: 2 }}
          />

          <Typography variant="subtitle2" sx={{ mt: 2, mb: 1 }}>
            SMTP Settings (Outgoing Mail)
          </Typography>
          <TextField
            label="SMTP Host"
            type="text"
            value={formData.smtpHost}
            onChange={handleChange("smtpHost")}
            error={!!errors.smtpHost}
            helperText={errors.smtpHost}
            required
            fullWidth
            variant="outlined"
            sx={{ mb: 2 }}
          />
          <TextField
            label="SMTP Port"
            type="number"
            value={formData.smtpPort}
            onChange={handleChange("smtpPort")}
            required
            fullWidth
            variant="outlined"
            sx={{ mb: 2 }}
          />
        </>
      )}

      <Button
        type="submit"
        fullWidth
        disabled={loading}
        variant="contained"
        color="primary"
        startIcon={loading ? <CircularProgress size={20} /> : null}
        sx={{ mt: 3, mb: 2 }}
      >
        Register
      </Button>
    </Box>
  );
};

export default RegistrationForm;
