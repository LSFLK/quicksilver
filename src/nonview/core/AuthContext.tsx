import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { APIClient, APIError, defaultBaseURL } from "../api/client";
import { auth as authAPI } from "../api/endpoints";
import type { LoginRequest } from "../api/types";

// Profile holds the user's IMAP/SMTP configuration. It is stored in
// localStorage so we don't have to ask the user to re-enter their server
// settings on every sign-in. We deliberately DO NOT store the password — the
// user re-enters it each login.
interface MailProfile {
  name: string;
  email: string;
  emailServiceProvider?: string;
  emailAddress: string;
  imapHost: string;
  imapPort: number;
  imapSecure: boolean;
  smtpHost: string;
  smtpPort: number;
  smtpSecure: boolean;
}

interface CurrentUser {
  id: string;
  email: string;
  name: string;
  emailServiceProvider?: string;
  emailAddress: string;
  imapHost: string;
  imapPort: number;
  imapSecure: boolean;
  smtpHost: string;
  smtpPort: number;
  smtpSecure: boolean;
}

interface RegistrationData extends MailProfile {
  password: string;
  emailPassword: string;
}

interface AuthContextValue {
  currentUser: CurrentUser | null;
  isAuthenticated: boolean;
  loading: boolean;
  apiClient: APIClient;
  login: (email: string, password: string) => Promise<CurrentUser>;
  register: (data: RegistrationData) => Promise<CurrentUser>;
  logout: () => Promise<void>;
  resetPassword: (email: string) => Promise<{ message: string }>;
  updateProfile: (data: Partial<MailProfile>) => Promise<CurrentUser>;
}

const STORAGE_PROFILE = "quicksilver_profile";
const STORAGE_JWT = "quicksilver_jwt";

const AuthContext = createContext<AuthContextValue | null>(null);

export const useAuth = (): AuthContextValue => {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return ctx;
};

function readProfile(): MailProfile | null {
  const raw = localStorage.getItem(STORAGE_PROFILE);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as MailProfile;
  } catch {
    localStorage.removeItem(STORAGE_PROFILE);
    return null;
  }
}

function writeProfile(p: MailProfile): void {
  localStorage.setItem(STORAGE_PROFILE, JSON.stringify(p));
}

function profileToUser(p: MailProfile): CurrentUser {
  return {
    id: p.email,
    name: p.name,
    email: p.email,
    emailServiceProvider: p.emailServiceProvider,
    emailAddress: p.emailAddress,
    imapHost: p.imapHost,
    imapPort: p.imapPort,
    imapSecure: p.imapSecure,
    smtpHost: p.smtpHost,
    smtpPort: p.smtpPort,
    smtpSecure: p.smtpSecure,
  };
}

interface AuthProviderProps {
  children: React.ReactNode;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [loading, setLoading] = useState(true);
  const tokenRef = useRef<string | null>(localStorage.getItem(STORAGE_JWT));

  // Stable reference so callers can use `useEffect(..., [apiClient])` safely.
  const apiClient = useMemo(
    () =>
      new APIClient({
        baseURL: defaultBaseURL(),
        getToken: () => tokenRef.current,
        onUnauthorized: () => {
          tokenRef.current = null;
          localStorage.removeItem(STORAGE_JWT);
          setIsAuthenticated(false);
          setCurrentUser(null);
        },
      }),
    [],
  );

  // Rehydrate session on mount: if a JWT and profile are both present we
  // assume the session is still valid; the next API call will tell us
  // otherwise (and onUnauthorized will clear state).
  useEffect(() => {
    const profile = readProfile();
    if (profile && tokenRef.current) {
      setCurrentUser(profileToUser(profile));
      setIsAuthenticated(true);
    }
    setLoading(false);
  }, []);

  const persistSession = useCallback(
    (token: string, profile: MailProfile): CurrentUser => {
      tokenRef.current = token;
      localStorage.setItem(STORAGE_JWT, token);
      writeProfile(profile);
      const user = profileToUser(profile);
      setCurrentUser(user);
      setIsAuthenticated(true);
      return user;
    },
    [],
  );

  const performLogin = useCallback(
    async (profile: MailProfile, password: string): Promise<CurrentUser> => {
      const req: LoginRequest = {
        email: profile.emailAddress,
        password,
        imap_host: profile.imapHost,
        imap_port: profile.imapPort,
        imap_secure: profile.imapSecure,
        smtp_host: profile.smtpHost,
        smtp_port: profile.smtpPort,
        smtp_secure: profile.smtpSecure,
      };
      const resp = await authAPI.login(apiClient, req);
      return persistSession(resp.token, profile);
    },
    [apiClient, persistSession],
  );

  const login = useCallback(
    async (email: string, password: string): Promise<CurrentUser> => {
      const profile = readProfile();
      if (!profile) {
        throw new APIError(
          400,
          "no_profile",
          "No email profile found on this device. Please register first to configure your email server.",
        );
      }
      const entered = email.toLowerCase();
      if (
        profile.email.toLowerCase() !== entered &&
        profile.emailAddress.toLowerCase() !== entered
      ) {
        throw new APIError(
          400,
          "wrong_email",
          `This device is registered for ${profile.email}. Sign out and re-register to use a different address.`,
        );
      }
      return performLogin(profile, password);
    },
    [performLogin],
  );

  const register = useCallback(
    async (data: RegistrationData): Promise<CurrentUser> => {
      const profile: MailProfile = {
        name: data.name,
        email: data.email,
        emailServiceProvider: data.emailServiceProvider,
        emailAddress: data.emailAddress,
        imapHost: data.imapHost,
        imapPort: data.imapPort,
        imapSecure: data.imapSecure,
        smtpHost: data.smtpHost,
        smtpPort: data.smtpPort,
        smtpSecure: data.smtpSecure,
      };
      return performLogin(profile, data.emailPassword);
    },
    [performLogin],
  );

  const logout = useCallback(async (): Promise<void> => {
    try {
      await authAPI.logout(apiClient);
    } catch {
      // Server-side cleanup is best-effort; we still clear local state.
    }
    tokenRef.current = null;
    localStorage.removeItem(STORAGE_JWT);
    setCurrentUser(null);
    setIsAuthenticated(false);
  }, [apiClient]);

  const resetPassword = useCallback(
    async (_email: string): Promise<{ message: string }> => {
      // Password reset is handled by the upstream mail provider, not by Quicksilver.
      return {
        message:
          "Password resets are handled by your email provider (e.g., Gmail). Please reset there, then sign in again.",
      };
    },
    [],
  );

  const updateProfile = useCallback(
    async (updates: Partial<MailProfile>): Promise<CurrentUser> => {
      const profile = readProfile();
      if (!profile) {
        throw new APIError(400, "no_profile", "No profile to update");
      }
      const next = { ...profile, ...updates };
      writeProfile(next);
      const user = profileToUser(next);
      setCurrentUser(user);
      return user;
    },
    [],
  );

  const value: AuthContextValue = {
    currentUser,
    isAuthenticated,
    loading,
    apiClient,
    login,
    register,
    logout,
    resetPassword,
    updateProfile,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export default AuthContext;
