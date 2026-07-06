import { Suspense, lazy } from "react";
import { ThemeProvider, CssBaseline, CircularProgress, Box } from "@mui/material";
import { Routes, Route, Navigate } from "react-router-dom";
import theme from "./theme";
import { AuthProvider } from "./nonview/core/AuthContext";
import { DataProvider } from "./nonview/core/DataContext";

// Import page components
import LoginPage from "./view/pages/LoginPage";
import RegisterPage from "./view/pages/RegisterPage";
import ForgotPasswordPage from "./view/pages/ForgotPasswordPage";
import InboxPage from "./view/pages/InboxPage";
import SentPage from "./view/pages/SentPage";
import DraftsPage from "./view/pages/DraftsPage";
import TrashPage from "./view/pages/TrashPage";
import ThreadPage from "./view/pages/ThreadPage";
import ProfilePage from "./view/pages/ProfilePage";
import NotFoundPage from "./view/pages/NotFoundPage";

// Import ProtectedRoute component
import ProtectedRoute from "./view/moles/ProtectedRoute";
import { ComposeProvider } from "./view/moles/ComposeProvider";

// Compose pulls in react-email (templates + renderer). Lazy-load it so that
// weight only ships when the user actually opens the composer.
const ComposePage = lazy(() => import("./view/pages/ComposePage"));

const RouteFallback = () => (
  <Box sx={{ display: "flex", justifyContent: "center", alignItems: "center", minHeight: "60vh" }}>
    <CircularProgress />
  </Box>
);

function App() {
  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <AuthProvider>
        <DataProvider>
          <ComposeProvider>
          <Routes>
            {/* Public Routes */}
            <Route path="/login" element={<LoginPage />} />
            <Route path="/register" element={<RegisterPage />} />
            <Route path="/forgot-password" element={<ForgotPasswordPage />} />

            {/* Protected Routes */}
            <Route
              path="/"
              element={
                <ProtectedRoute>
                  <Navigate to="/inbox" replace />
                </ProtectedRoute>
              }
            />
            <Route
              path="/inbox"
              element={
                <ProtectedRoute>
                  <InboxPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/sent"
              element={
                <ProtectedRoute>
                  <SentPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/drafts"
              element={
                <ProtectedRoute>
                  <DraftsPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/trash"
              element={
                <ProtectedRoute>
                  <TrashPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/thread/:threadId"
              element={
                <ProtectedRoute>
                  <ThreadPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/compose"
              element={
                <ProtectedRoute>
                  <Suspense fallback={<RouteFallback />}>
                    <ComposePage />
                  </Suspense>
                </ProtectedRoute>
              }
            />
            <Route
              path="/profile"
              element={
                <ProtectedRoute>
                  <ProfilePage />
                </ProtectedRoute>
              }
            />

            {/* 404 Not Found - catch all */}
            <Route path="*" element={<NotFoundPage />} />
          </Routes>
          </ComposeProvider>
        </DataProvider>
      </AuthProvider>
    </ThemeProvider>
  );
}

export default App;
