import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useAuth } from "./AuthContext";
import { APIClient, APIError, defaultBaseURL } from "../api/client";
import {
  type AccountSession,
  type LinkedAccount,
  type RegistrationData,
  getAccount,
  getAccounts,
  getSession,
  getSessions,
  removeSession,
  saveAccount,
  saveSession,
  toLoginRequest,
  updateAccount as updateAccountStorage,
} from "./accountStorage";
interface AccountContextValue {
  accounts: LinkedAccount[];
  sessions: AccountSession[];
  activeAccount: LinkedAccount | null;
  activeSession: AccountSession | null; // null → activeAccount needs re-auth
  isAuthenticated: boolean;
  loading: boolean;
  apiClient: APIClient;

  addAccount: (data: RegistrationData) => Promise<LinkedAccount>;
  reauthenticate: (id: string, password: string) => Promise<void>;
  updateAccount: (id: string, updates: Partial<LinkedAccount>) => LinkedAccount | null;
  signOut: (id: string) => Promise<void>;
  switchAccount: (id: string) => void;
  removeAccount: (id: string) => Promise<void>;
  logoutAll: () => Promise<void>;
}

const STORAGE_ACTIVE_ACCOUNT = "quicksilver_active_account";

const AccountContext = createContext<AccountContextValue | null>(null);

export const useAccount = (): AccountContextValue => {
  const ctx = useContext(AccountContext);
  if (!ctx) {
    throw new Error("useAccount must be used within an AccountProvider");
  }
  return ctx;
};

interface AccountProviderProps {
  children: React.ReactNode;
}

export const AccountProvider: React.FC<AccountProviderProps> = ({ children }) => {
  const authContext = useAuth();

  const [accounts, setAccounts] = useState<LinkedAccount[]>([]);
  const [sessions, setSessions] = useState<AccountSession[]>([]);
  const [activeAccountId, setActiveAccountId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const activeAccount = useMemo(
    () => accounts.find((a) => a.id === activeAccountId) ?? null,
    [accounts, activeAccountId],
  );
  const activeSession = useMemo(
    () => sessions.find((s) => s.accountId === activeAccountId) ?? null,
    [sessions, activeAccountId],
  );
  const isAuthenticated = activeSession !== null;

  const activeSessionRef = useRef<AccountSession | null>(activeSession);
  useEffect(() => {
    activeSessionRef.current = activeSession;
  }, [activeSession]);

  const apiClient = useMemo(
    () =>
      new APIClient({
        baseURL: defaultBaseURL(),
        getToken: () => activeSessionRef.current?.token ?? null,
        onUnauthorized: () => {
          const s = activeSessionRef.current;
          if (!s) return;
          removeSession(s.accountId);
          setSessions((prev) => prev.filter((x) => x.accountId !== s.accountId));
        },
      }),
    [],
  );

  useEffect(() => {
    const loadedAccounts = getAccounts();
    const loadedSessions = getSessions();
    setAccounts(loadedAccounts);
    setSessions(loadedSessions);

    const urlAccountId = new URLSearchParams(window.location.search).get("account");
    const hasValidUrlAccount =
      !!urlAccountId && loadedAccounts.some((a) => a.id === urlAccountId);

    let id = hasValidUrlAccount ? urlAccountId : sessionStorage.getItem(STORAGE_ACTIVE_ACCOUNT);
    if (!id && loadedAccounts.length === 1) {
      id = loadedAccounts[0].id;
    }
    if (id) sessionStorage.setItem(STORAGE_ACTIVE_ACCOUNT, id);
    setActiveAccountId(id);
    setLoading(false);
  }, []);

  const switchAccount = useCallback((id: string): void => {
    sessionStorage.setItem(STORAGE_ACTIVE_ACCOUNT, id);
    setActiveAccountId(id);
  }, []);

  const addAccount = useCallback(
    async (data: RegistrationData): Promise<LinkedAccount> => {
      const id = data.email.toLowerCase();
      if (getAccounts().some((a) => a.id === id)) {
        throw new APIError(
          400,
          "duplicate_account",
          `${data.email} is already linked on this device.`,
        );
      }
      const resp = await authContext.register(data);
      const account: LinkedAccount = {
        id,
        email: data.email,
        name: data.name,
        emailServiceProvider: data.emailServiceProvider,
        imapHost: data.imapHost,
        imapPort: data.imapPort,
        imapSecure: data.imapSecure,
        smtpHost: data.smtpHost,
        smtpPort: data.smtpPort,
        smtpSecure: data.smtpSecure,
      };
      saveAccount(account);
      saveSession({ accountId: id, token: resp.token, expiresAt: resp.expires_at });
      setAccounts(getAccounts());
      setSessions(getSessions());
      return account;
    },
    [authContext],
  );

  const reauthenticate = useCallback(
    async (id: string, password: string): Promise<void> => {
      const account = getAccount(id);
      if (!account) {
        throw new APIError(400, "no_account", "No linked account found for that id.");
      }
      const resp = await authContext.login(toLoginRequest(account, password));
      saveSession({ accountId: id, token: resp.token, expiresAt: resp.expires_at });
      setSessions(getSessions());
      if (!activeAccountId) switchAccount(id);
    },
    [authContext, activeAccountId, switchAccount],
  );

  const updateAccount = useCallback(
    (id: string, updates: Partial<LinkedAccount>): LinkedAccount | null => {
      const updated = updateAccountStorage(id, updates);
      if (updated) setAccounts(getAccounts());
      return updated;
    },
    [],
  );

  const signOut = useCallback(
    async (id: string): Promise<void> => {
      const session = getSession(id);
      if (session) {
        await authContext.logout(session);
      }
      removeSession(id);
      setSessions(getSessions());
    },
    [authContext],
  );

  const removeAccount = useCallback(async (_id: string): Promise<void> => {
    throw new Error("removeAccount is not implemented yet — see Parent Issue 5");
  }, []);

  const logoutAll = useCallback(async (): Promise<void> => {
    throw new Error("logoutAll is not implemented yet — see Parent Issue 5");
  }, []);

  const value: AccountContextValue = {
    accounts,
    sessions,
    activeAccount,
    activeSession,
    isAuthenticated,
    loading,
    apiClient,
    addAccount,
    reauthenticate,
    updateAccount,
    signOut,
    switchAccount,
    removeAccount,
    logoutAll,
  };

  return <AccountContext.Provider value={value}>{children}</AccountContext.Provider>;
};

export default AccountContext;
