// Multi-account storage layer. Replaces the single-profile model (see
// AuthContext.tsx's MailProfile) with a list of linked accounts and a
// separate list of their sessions — accounts and sessions have different
// lifecycles (a 401 invalidates a session, not the linked account).
//
// Nothing consumes this module yet; it's additive groundwork for the
// upcoming AccountContext.

export interface LinkedAccount {
  id: string; // stable id, e.g. lowercased email
  email: string;
  name: string;
  emailServiceProvider?: string;
  imapHost: string;
  imapPort: number;
  imapSecure: boolean;
  smtpHost: string;
  smtpPort: number;
  smtpSecure: boolean;
}

export interface AccountSession {
  accountId: string; // FK -> LinkedAccount.id
  token: string;
  expiresAt: string; // ISO 8601
}

const STORAGE_ACCOUNTS = "quicksilver_accounts";
const STORAGE_SESSIONS = "quicksilver_sessions";

// A storage read must never break the app — fall back to an empty list.
function readList<T>(key: string): T[] {
  const raw = localStorage.getItem(key);
  if (!raw) return [];
  try {
    return JSON.parse(raw) as T[];
  } catch {
    localStorage.removeItem(key);
    return [];
  }
}

function writeList<T>(key: string, list: T[]): void {
  localStorage.setItem(key, JSON.stringify(list));
}

// ---- Accounts ----

export function getAccounts(): LinkedAccount[] {
  return readList<LinkedAccount>(STORAGE_ACCOUNTS);
}

export function getAccount(id: string): LinkedAccount | null {
  return getAccounts().find((a) => a.id === id) ?? null;
}

export function saveAccount(account: LinkedAccount): void {
  const accounts = getAccounts();
  const idx = accounts.findIndex((a) => a.id === account.id);
  if (idx === -1) {
    accounts.push(account);
  } else {
    accounts[idx] = account;
  }
  writeList(STORAGE_ACCOUNTS, accounts);
}

export function updateAccount(
  id: string,
  updates: Partial<LinkedAccount>,
): LinkedAccount | null {
  const accounts = getAccounts();
  const idx = accounts.findIndex((a) => a.id === id);
  if (idx === -1) return null;
  const updated = { ...accounts[idx], ...updates };
  accounts[idx] = updated;
  writeList(STORAGE_ACCOUNTS, accounts);
  return updated;
}

export function removeAccount(id: string): void {
  writeList(
    STORAGE_ACCOUNTS,
    getAccounts().filter((a) => a.id !== id),
  );
}

// ---- Sessions ----

export function getSessions(): AccountSession[] {
  return readList<AccountSession>(STORAGE_SESSIONS);
}

export function getSession(accountId: string): AccountSession | null {
  return getSessions().find((s) => s.accountId === accountId) ?? null;
}

export function saveSession(session: AccountSession): void {
  const sessions = getSessions();
  const idx = sessions.findIndex((s) => s.accountId === session.accountId);
  if (idx === -1) {
    sessions.push(session);
  } else {
    sessions[idx] = session;
  }
  writeList(STORAGE_SESSIONS, sessions);
}

export function updateSession(
  accountId: string,
  updates: Partial<AccountSession>,
): AccountSession | null {
  const sessions = getSessions();
  const idx = sessions.findIndex((s) => s.accountId === accountId);
  if (idx === -1) return null;
  const updated = { ...sessions[idx], ...updates };
  sessions[idx] = updated;
  writeList(STORAGE_SESSIONS, sessions);
  return updated;
}

export function removeSession(accountId: string): void {
  writeList(
    STORAGE_SESSIONS,
    getSessions().filter((s) => s.accountId !== accountId),
  );
}
