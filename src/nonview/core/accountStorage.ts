// Multi-account storage layer. Replaces the single-profile model (see
// AuthContext.tsx's MailProfile) with a list of linked accounts and a
// separate list of their sessions — accounts and sessions have different
// lifecycles (a 401 invalidates a session, not the linked account).
//
// Nothing consumes this module yet; it's additive groundwork for the
// upcoming AccountContext.

import type { LoginRequest } from "../api/types";

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

// What's needed to link a new account: every LinkedAccount field (id is
// derived at creation time, not user-supplied) plus the mailbox password —
// never persisted, only ever sent once to obtain a session token.
export interface RegistrationData extends Omit<LinkedAccount, "id"> {
  emailPassword: string;
}

// Shared by AuthContext.register (from RegistrationData) and
// AccountContext.reauthenticate (from a stored LinkedAccount) — both carry
// the same IMAP/SMTP fields, just from a different source object.
export function toLoginRequest(
  account: Pick<
    LinkedAccount,
    "email" | "imapHost" | "imapPort" | "imapSecure" | "smtpHost" | "smtpPort" | "smtpSecure"
  >,
  password: string,
): LoginRequest {
  return {
    email: account.email,
    password,
    imap_host: account.imapHost,
    imap_port: account.imapPort,
    imap_secure: account.imapSecure,
    smtp_host: account.smtpHost,
    smtp_port: account.smtpPort,
    smtp_secure: account.smtpSecure,
  };
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
