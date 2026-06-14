import React, { useState } from "react";
import {
  Box,
  Stack,
  TextField,
  Button,
  CircularProgress,
  MenuItem,
  Typography,
  Divider,
} from "@mui/material";
import ErrorMessage from "../atoms/ErrorMessage";

// Email service provider configurations
const EMAIL_PROVIDERS = {
  gmail: {
    name: "Gmail",
    imapHost: "imap.gmail.com",
    imapPort: 993,
    imapSecure: true,
    smtpHost: "smtp.gmail.com",
    smtpPort: 587,
    smtpSecure: true,
  },
  outlook: {
    name: "Outlook",
    imapHost: "outlook.office365.com",
    imapPort: 993,
    imapSecure: true,
    smtpHost: "smtp.office365.com",
    smtpPort: 587,
    smtpSecure: true,
  },
  yahoo: {
    name: "Yahoo Mail",
    imapHost: "imap.mail.yahoo.com",
    imapPort: 993,
    imapSecure: true,
    smtpHost: "smtp.mail.yahoo.com",
    smtpPort: 587,
    smtpSecure: true,
  },
  custom: {
    name: "Custom",
    imapHost: "",
    imapPort: 993,
    imapSecure: true,
    smtpHost: "",
    smtpPort: 587,
    smtpSecure: true,
  },
};

/**
 * ProfileForm - Form for editing user profile
 * @param {object} user - User object with current values
 * @param {function} onSubmit - Submit callback
 */
function ProfileForm({ user, onSubmit }) {
  const [formData, setFormData] = useState({
    name: user.name || "",
    email: user.email || "",
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",
    // Email service configuration
    emailServiceProvider: user.emailServiceProvider || "gmail",
    emailAddress: user.emailAddress || "",
    emailPassword: user.emailPassword || "",
    imapHost: user.imapHost || EMAIL_PROVIDERS.gmail.imapHost,
    imapPort: user.imapPort || EMAIL_PROVIDERS.gmail.imapPort,
    imapSecure: user.imapSecure ?? EMAIL_PROVIDERS.gmail.imapSecure,
    smtpHost: user.smtpHost || EMAIL_PROVIDERS.gmail.smtpHost,
    smtpPort: user.smtpPort || EMAIL_PROVIDERS.gmail.smtpPort,
    smtpSecure: user.smtpSecure ?? EMAIL_PROVIDERS.gmail.smtpSecure,
  });
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(false);

  const handleChange = (e) => {
    const { name, value } = e.target;
    let updates = { [name]: value };

    // Auto-populate server settings when provider changes
    if (name === "emailServiceProvider" && EMAIL_PROVIDERS[value]) {
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

    setFormData((prev) => ({ ...prev, ...updates }));
    setError("");
    setSuccess("");
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setSuccess("");

    // Basic validation
    if (!formData.name.trim()) {
      setError("Name is required");
      return;
    }

    if (!formData.email.trim()) {
      setError("Email is required");
      return;
    }

    // Email format validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(formData.email)) {
      setError("Please enter a valid email address");
      return;
    }

    // Password validation (if changing password)
    if (formData.newPassword || formData.confirmPassword) {
      if (!formData.currentPassword) {
        setError("Current password is required to change password");
        return;
      }
      if (formData.newPassword !== formData.confirmPassword) {
        setError("New passwords do not match");
        return;
      }
      if (formData.newPassword.length < 6) {
        setError("New password must be at least 6 characters");
        return;
      }
    }

    setLoading(true);
    try {
      // Prepare update data
      const updateData = {
        name: formData.name,
        email: formData.email,
        // Email service configuration
        emailServiceProvider: formData.emailServiceProvider,
        emailAddress: formData.emailAddress,
        emailPassword: formData.emailPassword,
        imapHost: formData.imapHost,
        imapPort: parseInt(formData.imapPort),
        imapSecure: formData.imapSecure,
        smtpHost: formData.smtpHost,
        smtpPort: parseInt(formData.smtpPort),
        smtpSecure: formData.smtpSecure,
      };

      // Only include password fields if changing password
      if (formData.newPassword) {
        updateData.currentPassword = formData.currentPassword;
        updateData.newPassword = formData.newPassword;
      }

      await onSubmit(updateData);
      setSuccess("Profile updated successfully");

      // Clear password fields after successful update
      setFormData((prev) => ({
        ...prev,
        currentPassword: "",
        newPassword: "",
        confirmPassword: "",
      }));
    } catch (err) {
      setError(err.message || "Failed to update profile");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Box
      component="form"
      onSubmit={handleSubmit}
      sx={{ maxWidth: 500, mx: "auto", px: 2 }}
    >
      <Stack spacing={3}>
        {error && (
          <ErrorMessage message={error} onDismiss={() => setError("")} />
        )}
        {success && (
          <ErrorMessage
            message={success}
            variant="success"
            onDismiss={() => setSuccess("")}
          />
        )}

        <TextField
          label="Name"
          type="text"
          name="name"
          value={formData.name}
          onChange={handleChange}
          disabled={loading}
          fullWidth
          variant="outlined"
        />

        <TextField
          label="Email"
          type="email"
          name="email"
          value={formData.email}
          onChange={handleChange}
          disabled={loading}
          fullWidth
          variant="outlined"
        />

        <Box sx={{ pt: 2, borderTop: 1, borderColor: "divider" }}>
          <TextField
            label="Current Password"
            type="password"
            name="currentPassword"
            value={formData.currentPassword}
            onChange={handleChange}
            placeholder="Enter current password to change"
            disabled={loading}
            fullWidth
            variant="outlined"
          />
        </Box>

        <TextField
          label="New Password"
          type="password"
          name="newPassword"
          value={formData.newPassword}
          onChange={handleChange}
          placeholder="Leave blank to keep current password"
          disabled={loading}
          fullWidth
          variant="outlined"
        />

        <TextField
          label="Confirm New Password"
          type="password"
          name="confirmPassword"
          value={formData.confirmPassword}
          onChange={handleChange}
          placeholder="Confirm new password"
          disabled={loading}
          fullWidth
          variant="outlined"
        />

        <Divider sx={{ my: 2 }} />
        <Typography variant="h6" gutterBottom>
          Email Service Configuration
        </Typography>

        <TextField
          select
          label="Email Service Provider"
          name="emailServiceProvider"
          value={formData.emailServiceProvider}
          onChange={handleChange}
          disabled={loading}
          fullWidth
          variant="outlined"
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
          name="emailAddress"
          value={formData.emailAddress}
          onChange={handleChange}
          helperText="Your actual email address (e.g., yourname@gmail.com)"
          disabled={loading}
          fullWidth
          variant="outlined"
        />

        <TextField
          label="Email Password / App Password"
          type="password"
          name="emailPassword"
          value={formData.emailPassword}
          onChange={handleChange}
          helperText="For Gmail/Outlook, use an app-specific password"
          disabled={loading}
          fullWidth
          variant="outlined"
        />

        {formData.emailServiceProvider === "custom" && (
          <>
            <Typography variant="subtitle2" sx={{ mt: 2, mb: 1 }}>
              IMAP Settings (Incoming Mail)
            </Typography>
            <TextField
              label="IMAP Host"
              type="text"
              name="imapHost"
              value={formData.imapHost}
              onChange={handleChange}
              disabled={loading}
              fullWidth
              variant="outlined"
            />
            <TextField
              label="IMAP Port"
              type="number"
              name="imapPort"
              value={formData.imapPort}
              onChange={handleChange}
              disabled={loading}
              fullWidth
              variant="outlined"
            />

            <Typography variant="subtitle2" sx={{ mt: 2, mb: 1 }}>
              SMTP Settings (Outgoing Mail)
            </Typography>
            <TextField
              label="SMTP Host"
              type="text"
              name="smtpHost"
              value={formData.smtpHost}
              onChange={handleChange}
              disabled={loading}
              fullWidth
              variant="outlined"
            />
            <TextField
              label="SMTP Port"
              type="number"
              name="smtpPort"
              value={formData.smtpPort}
              onChange={handleChange}
              disabled={loading}
              fullWidth
              variant="outlined"
            />
          </>
        )}

        <Button
          type="submit"
          variant="contained"
          color="primary"
          disabled={loading}
          startIcon={loading ? <CircularProgress size={20} /> : null}
          fullWidth
        >
          Save Changes
        </Button>
      </Stack>
    </Box>
  );
}

export default ProfileForm;
