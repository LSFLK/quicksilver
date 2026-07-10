import React, { createContext, useContext, useMemo } from "react";
import { APIClient, defaultBaseURL } from "../api/client";
import { auth as authAPI } from "../api/endpoints";
import { type AccountSession, type RegistrationData, toLoginRequest } from "./accountStorage";
import type { LoginRequest, LoginResponse } from "../api/types";

// Pure auth mechanics: how credentials become a valid session. No account
// list, no active-account state, no apiClient ownership — that's
// AccountContext's job (it depends on this context, never the reverse).
interface AuthContextValue {
  login: (req: LoginRequest) => Promise<LoginResponse>;
  register: (data: RegistrationData) => Promise<LoginResponse>;
  logout: (session: AccountSession) => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export const useAuth = (): AuthContextValue => {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return ctx;
};

interface AuthProviderProps {
  children: React.ReactNode;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  // Unauthenticated, stable client for login/register — postUnauthed doesn't
  // send a token anyway, but APIClient still requires the callbacks.
  const unauthedClient = useMemo(
    () =>
      new APIClient({
        baseURL: defaultBaseURL(),
        getToken: () => null,
        onUnauthorized: () => {},
      }),
    [],
  );

  const login = async (req: LoginRequest): Promise<LoginResponse> => {
    return authAPI.login(unauthedClient, req);
  };

  const register = async (data: RegistrationData): Promise<LoginResponse> => {
    const req: LoginRequest = {
      email: data.email,
      password: data.emailPassword,
      imap_host: data.imapHost,
      imap_port: data.imapPort,
      imap_secure: data.imapSecure,
      smtp_host: data.smtpHost,
      smtp_port: data.smtpPort,
      smtp_secure: data.smtpSecure,
    };
    return authAPI.login(unauthedClient, req);
  };

  // Logging out a specific session (which may not be the active account)
  // needs a client scoped to that session's own token — endpoints.ts's
  // auth.logout(client) has no session param, it relies entirely on
  // whatever token the client instance returns.
  const logout = async (session: AccountSession): Promise<void> => {
    const client = new APIClient({
      baseURL: defaultBaseURL(),
      getToken: () => session.token,
      onUnauthorized: () => {},
    });
    try {
      await authAPI.logout(client);
    } catch {
      // Server-side cleanup is best-effort; callers still drop the local session.
    }
  };

  const value: AuthContextValue = { login, register, logout };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export default AuthContext;
