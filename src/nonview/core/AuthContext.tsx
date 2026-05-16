import React, { createContext, useContext, useState, useEffect } from "react";

const AuthContext = createContext(null);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};

export const AuthProvider = ({ children }) => {
  const [currentUser, setCurrentUser] = useState(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [loading, setLoading] = useState(true);

  // Check for existing session on mount
  useEffect(() => {
    const storedUser = localStorage.getItem("handa_user");
    if (storedUser) {
      try {
        const user = JSON.parse(storedUser);
        setCurrentUser(user);
        setIsAuthenticated(true);
      } catch (error) {
        console.error("Failed to parse stored user:", error);
        localStorage.removeItem("handa_user");
      }
    }
    setLoading(false);
  }, []);

  const login = async (email, password) => {
    // TODO: Replace with actual API call
    return new Promise((resolve, reject) => {
      setTimeout(() => {
        if (email && password) {
          const user = {
            id: "1",
            email,
            name: email.split("@")[0],
          };
          setCurrentUser(user);
          setIsAuthenticated(true);
          localStorage.setItem("handa_user", JSON.stringify(user));
          resolve(user);
        } else {
          reject(new Error("Invalid credentials"));
        }
      }, 500);
    });
  };

  const register = async (userData) => {
    // TODO: Replace with actual API call
    return new Promise((resolve, reject) => {
      setTimeout(() => {
        if (userData.email && userData.password && userData.name) {
          const user = {
            id: Date.now().toString(),
            email: userData.email,
            name: userData.name,
            // Email service configuration
            emailServiceProvider: userData.emailServiceProvider,
            emailAddress: userData.emailAddress,
            emailPassword: userData.emailPassword,
            imapHost: userData.imapHost,
            imapPort: userData.imapPort,
            imapSecure: userData.imapSecure,
            smtpHost: userData.smtpHost,
            smtpPort: userData.smtpPort,
            smtpSecure: userData.smtpSecure,
          };
          setCurrentUser(user);
          setIsAuthenticated(true);
          localStorage.setItem("handa_user", JSON.stringify(user));
          resolve(user);
        } else {
          reject(new Error("Invalid registration data"));
        }
      }, 500);
    });
  };

  const logout = () => {
    setCurrentUser(null);
    setIsAuthenticated(false);
    localStorage.removeItem("handa_user");
  };

  const updateProfile = async (userData) => {
    // TODO: Replace with actual API call
    return new Promise((resolve, reject) => {
      setTimeout(() => {
        if (currentUser) {
          const updatedUser = { ...currentUser, ...userData };
          setCurrentUser(updatedUser);
          localStorage.setItem("handa_user", JSON.stringify(updatedUser));
          resolve(updatedUser);
        } else {
          reject(new Error("No user logged in"));
        }
      }, 500);
    });
  };

  const resetPassword = async (email) => {
    // TODO: Replace with actual API call
    return new Promise((resolve) => {
      setTimeout(() => {
        resolve({ message: "Password reset email sent" });
      }, 500);
    });
  };

  const value = {
    currentUser,
    isAuthenticated,
    loading,
    login,
    logout,
    register,
    updateProfile,
    resetPassword,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export default AuthContext;
