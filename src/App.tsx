import { Suspense, lazy } from "react";
import { ThemeProvider, CssBaseline, CircularProgress, Box } from "@mui/material";
import { Routes, Route, Navigate } from "react-router-dom";
import theme from "./theme";
import { AuthProvider } from "./nonview/core/AuthContext";
import { AccountProvider } from "./nonview/core/AccountContext";
import { DataProvider } from "./nonview/core/DataContext";

// Import page components
import LoginPage from "./view/pages/LoginPage";
import RegisterPage from "./view/pages/RegisterPage";
import ForgotPasswordPage from "./view/pages/ForgotPasswordPage";
import MailPage from "./view/pages/MailPage";
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
        <AccountProvider>
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
                      <MailPage />
                    </ProtectedRoute>
                  }
                >
                  <Route
                    path="thread/:threadId"
                    element={
                      <ProtectedRoute>
                        <ThreadPage />
                      </ProtectedRoute>
                    }
                  />
                </Route>
                <Route
                  path="/inbox"
                  element={
                    <ProtectedRoute>
                      <Navigate to="/" replace />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/sent"
                  element={
                    <ProtectedRoute>
                      <Navigate to="/" replace />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/drafts"
                  element={
                    <ProtectedRoute>
                      <Navigate to="/" replace />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/trash"
                  element={
                    <ProtectedRoute>
                      <Navigate to="/" replace />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/conversations"
                  element={
                    <ProtectedRoute>
                      <Navigate to="/" replace />
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
        </AccountProvider>
      </AuthProvider>
    </ThemeProvider>
  );
}

export default App;
