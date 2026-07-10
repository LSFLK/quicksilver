import React from "react";
import { Navigate } from "react-router-dom";
import { useAccount } from "../../nonview/core/AccountContext";
import { Box, CircularProgress } from "@mui/material";

function ProtectedRoute({ children }) {
  const { isAuthenticated, loading } = useAccount();

  if (loading) {
    // Show loading spinner while checking authentication
    return (
      <Box
        sx={{
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          height: "100vh",
        }}
      >
        <CircularProgress />
      </Box>
    );
  }

  if (!isAuthenticated) {
    // Redirect to login page if not authenticated
    return <Navigate to="/login" replace />;
  }

  return children;
}

export default ProtectedRoute;
