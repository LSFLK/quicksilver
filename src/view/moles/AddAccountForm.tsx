import React, { useState } from "react";
import {
  Box,
  Stack,
  TextField,
  Button,
  CircularProgress,
  MenuItem,
  Typography,
  MobileStepper,
} from "@mui/material";
import ErrorMessage from "../atoms/ErrorMessage";
import type { LinkedAccount, RegistrationData } from "../../nonview/core/accountStorage";

// Email service provider configurations
// smtpSecure=true means implicit TLS (port 465); 
// smtpSecure=false means STARTTLS on the submission port (587). 
// Gmail/Outlook/Yahoo all support both 
// we default to 465+implicit-TLS because it's a single negotiation and works
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

type Step = 1 | 2 | "success";

interface AddAccountFormProps {
  onSubmit: (data: RegistrationData) => Promise<LinkedAccount>;
  loading?: boolean;
  onSuccess: (account: LinkedAccount) => void;
  successCtaLabel?: string;
}

// Two-step "add another account" form
const AddAccountForm = ({
  onSubmit,
  loading = false,
  onSuccess,
  successCtaLabel = "Continue",
}: AddAccountFormProps) => {
  const [step, setStep] = useState<Step>(1);
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    emailServiceProvider: "gmail",
    emailAddress: "",
    emailPassword: "",
    imapHost: EMAIL_PROVIDERS.gmail.imapHost,
    imapPort: EMAIL_PROVIDERS.gmail.imapPort as number,
    imapSecure: EMAIL_PROVIDERS.gmail.imapSecure,
    smtpHost: EMAIL_PROVIDERS.gmail.smtpHost,
    smtpPort: EMAIL_PROVIDERS.gmail.smtpPort as number,
    smtpSecure: EMAIL_PROVIDERS.gmail.smtpSecure,
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [createdAccount, setCreatedAccount] = useState<LinkedAccount | null>(null);

  const isBusy = loading || submitting;

  const handleChange = (field: string) => (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    let updates: Record<string, unknown> = { [field]: value };

    // Auto-populate server settings when provider changes.
    if (field === "emailServiceProvider" && EMAIL_PROVIDERS[value as keyof typeof EMAIL_PROVIDERS]) {
      const provider = EMAIL_PROVIDERS[value as keyof typeof EMAIL_PROVIDERS];
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
    if (errors[field]) {
      setErrors((prev) => ({ ...prev, [field]: "" }));
    }
  };

  const validateStep1 = (): boolean => {
    const newErrors: Record<string, string> = {};
    if (!formData.name.trim()) {
      newErrors.name = "Name is required";
    }
    if (!formData.email) {
      newErrors.email = "Email is required";
    } else if (!/\S+@\S+\.\S+/.test(formData.email)) {
      newErrors.email = "Email is invalid";
    }
    setErrors((prev) => ({ ...prev, ...newErrors }));
    return Object.keys(newErrors).length === 0;
  };

  const validateStep2 = (): boolean => {
    const newErrors: Record<string, string> = {};
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
    setErrors((prev) => ({ ...prev, ...newErrors }));
    return Object.keys(newErrors).length === 0;
  };

  const handleContinue = () => {
    setFormError("");
    if (validateStep1()) {
      setStep(2);
    }
  };

  const handleBack = () => {
    setFormError("");
    setStep(1);
  };

  const handleComplete = async () => {
    setFormError("");
    if (!validateStep2()) return;

    // Prepare the payload for submission
    const payload = {
      name: formData.name,
      email: formData.email,
      emailServiceProvider: formData.emailServiceProvider,
      emailAddress: formData.emailAddress,
      emailPassword: formData.emailPassword,
      imapHost: formData.imapHost,
      imapPort: parseInt(String(formData.imapPort), 10),
      imapSecure: formData.imapSecure,
      smtpHost: formData.smtpHost,
      smtpPort: parseInt(String(formData.smtpPort), 10),
      smtpSecure: formData.smtpSecure,
    };

    setSubmitting(true);
    try {
      const account = await onSubmit(payload as RegistrationData);
      setCreatedAccount(account);
      setStep("success");
    } catch (error) {
      setFormError((error as Error).message || "Registration failed. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Box sx={{ width: "100%" }}>
      {step !== "success" && (
        <MobileStepper
          variant="dots"
          steps={2}
          position="static"
          activeStep={step - 1}
          backButton={<span />}
          nextButton={<span />}
          sx={{ justifyContent: "center", bgcolor: "transparent", px: 0, mb: 3 }}
        />
      )}

      {formError && step !== "success" && (
        <Box sx={{ mb: 2 }}>
          <ErrorMessage message={formError} onDismiss={() => setFormError("")} />
        </Box>
      )}

      {step === 1 && (
        <Stack spacing={2}>
          <Typography variant="h6" textAlign="center">
            Account Details
          </Typography>

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
            disabled={isBusy}
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
            disabled={isBusy}
          />

          <Button
            variant="contained"
            color="primary"
            fullWidth
            onClick={handleContinue}
            disabled={isBusy}
          >
            Continue to Email Setup
          </Button>
        </Stack>
      )}

      {step === 2 && (
        <Stack spacing={2}>
          <Typography variant="h6" textAlign="center">
            Email Service Configuration
          </Typography>
          <Typography variant="body2" color="text.secondary" textAlign="center">
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
            disabled={isBusy}
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
            helperText={errors.emailAddress || "Your actual email address (e.g., yourname@gmail.com)"}
            required
            fullWidth
            variant="outlined"
            disabled={isBusy}
          />
          <TextField
            label="Email Password / App Password"
            type="password"
            value={formData.emailPassword}
            onChange={handleChange("emailPassword")}
            error={!!errors.emailPassword}
            helperText={errors.emailPassword || "For Gmail/Outlook, use an app-specific password"}
            required
            fullWidth
            variant="outlined"
            disabled={isBusy}
          />

          {formData.emailServiceProvider === "custom" && (
            <>
              <Typography variant="subtitle2">IMAP Settings (Incoming Mail)</Typography>
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
                disabled={isBusy}
              />
              <TextField
                label="IMAP Port"
                type="number"
                value={formData.imapPort}
                onChange={handleChange("imapPort")}
                required
                fullWidth
                variant="outlined"
                disabled={isBusy}
              />

              <Typography variant="subtitle2">SMTP Settings (Outgoing Mail)</Typography>
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
                disabled={isBusy}
              />
              <TextField
                label="SMTP Port"
                type="number"
                value={formData.smtpPort}
                onChange={handleChange("smtpPort")}
                required
                fullWidth
                variant="outlined"
                disabled={isBusy}
              />
            </>
          )}

          <Stack direction="row" spacing={2}>
            <Button onClick={handleBack} disabled={isBusy}>
              Back
            </Button>
            <Button
              variant="contained"
              color="primary"
              fullWidth
              onClick={handleComplete}
              disabled={isBusy}
              startIcon={isBusy ? <CircularProgress size={20} /> : null}
            >
              Complete Registration
            </Button>
          </Stack>
        </Stack>
      )}

      {step === "success" && createdAccount && (
        <Stack spacing={2} alignItems="center" sx={{ textAlign: "center", py: 2 }}>
          <Typography variant="h6">Account added successfully!</Typography>
          <Typography variant="body2" color="text.secondary">
            {createdAccount.email} is now available in the account switcher.
          </Typography>
          <Button variant="contained" color="primary" onClick={() => onSuccess(createdAccount)}>
            {successCtaLabel}
          </Button>
        </Stack>
      )}
    </Box>
  );
};

export default AddAccountForm;
