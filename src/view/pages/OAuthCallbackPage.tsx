import React, { useEffect, useRef, useState } from "react";
import { Box, CircularProgress, Container, Typography } from "@mui/material";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../nonview/core/AuthContext";

// Landing page for the Google OAuth redirect. The backend appends the JWT (or
// an error code) to the URL fragment — e.g. #token=…&email=… — which never
// leaves the browser. We read it, persist the session, and route to the inbox.
function OAuthCallbackPage() {
  const navigate = useNavigate();
  const { loginWithOAuth } = useAuth();
  const [error, setError] = useState<string | null>(null);
  // Guard against React 18 StrictMode double-invoking the effect in dev.
  const handled = useRef(false);

  useEffect(() => {
    if (handled.current) return;
    handled.current = true;

    const frag = window.location.hash.replace(/^#/, "");
    const params = new URLSearchParams(frag);
    const errCode = params.get("error");
    const token = params.get("token");
    const email = params.get("email");

    // Clear the fragment so the token isn't left in the address bar / history.
    window.history.replaceState(null, "", window.location.pathname);

    if (errCode) {
      setError(oauthErrorMessage(errCode));
      return;
    }
    if (!token || !email) {
      setError("Sign-in response was incomplete. Please try again.");
      return;
    }
    loginWithOAuth(token, email);
    navigate("/inbox", { replace: true });
  }, [loginWithOAuth, navigate]);

  return (
    <Container maxWidth="sm">
      <Box
        sx={{
          marginTop: 12,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 2,
          textAlign: "center",
        }}
      >
        {error ? (
          <>
            <Typography variant="h6">Sign-in failed</Typography>
            <Typography variant="body2" color="text.secondary">
              {error}
            </Typography>
            <Typography
              variant="body2"
              sx={{ cursor: "pointer", color: "primary.main" }}
              onClick={() => navigate("/login", { replace: true })}
            >
              Back to sign in
            </Typography>
          </>
        ) : (
          <>
            <CircularProgress />
            <Typography variant="body2" color="text.secondary">
              Completing sign-in…
            </Typography>
          </>
        )}
      </Box>
    </Container>
  );
}

function oauthErrorMessage(code: string): string {
  switch (code) {
    case "invalid_state":
      return "The sign-in session expired or was tampered with. Please try again.";
    case "access_denied":
      return "You declined access. Sign-in was cancelled.";
    case "imap_login_failed":
      return "Google authorised the app, but connecting to Gmail failed. Make sure IMAP is enabled in your Gmail settings.";
    case "exchange_failed":
    case "userinfo_failed":
    case "issue_token_failed":
    case "missing_code":
      return "Something went wrong while completing sign-in. Please try again.";
    default:
      return `Sign-in error: ${code}`;
  }
}

export default OAuthCallbackPage;
