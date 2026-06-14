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
import { mailboxes as mailboxesAPI, messages as messagesAPI } from "../api/endpoints";
import type {
  Address,
  Envelope,
  Mailbox,
  Message,
} from "../api/types";

// Thread is the shape consumed by existing UI components. Each backend
// Envelope maps 1:1 to one Thread (server-side threading is a future phase).
//
// id encodes the mailbox + UID so we can route operations back through the
// right IMAP folder: "<mailbox>:<uid>".
export interface Participant {
  id: string;
  name: string;
  email: string;
}

export interface Thread {
  id: string;
  subject: string;
  participants: Participant[];
  lastMessage: string;
  lastMessageTime: string;
  unreadCount: number;
  hasAttachment: boolean;
  mailbox: string;
  uid: number;
}

export interface ThreadMessage {
  id: string;
  content: string;        // plain-text fallback
  contentHtml?: string;   // raw HTML from the upstream message; render only after sanitisation
  sender: Participant;
  timestamp: string;
  isRead: boolean;
}

interface DraftData {
  subject?: string;
  to?: Address[];
  body?: string;
  attachments?: unknown[];
}

interface EmailData {
  subject: string;
  to: Address[];
  cc?: Address[];
  bcc?: Address[];
  body: string;
  bodyHtml?: string;
  attachments?: unknown[];
  inReplyTo?: string;
  references?: string[];
}

interface DataContextValue {
  mailboxes: Mailbox[];
  threads: Thread[];
  sentThreads: Thread[];
  drafts: Thread[];
  trashedThreads: Thread[];
  contacts: Participant[];
  loading: boolean;
  error: string | null;
  unreadCount: number;
  refresh: () => Promise<void>;
  getThread: (id: string) => Thread | undefined;
  getMessages: (threadId: string) => Promise<ThreadMessage[]>;
  sendEmail: (data: EmailData) => Promise<{ status: string }>;
  saveDraft: (data: DraftData) => Promise<Thread>;
  deleteThread: (threadId: string) => Promise<void>;
  markAsRead: (threadId: string) => Promise<void>;
  // legacy alias kept for older components that called sendMessage(threadId, content)
  sendMessage: (threadId: string, content: string) => Promise<ThreadMessage>;
}

const DataContext = createContext<DataContextValue | null>(null);

export const useData = (): DataContextValue => {
  const ctx = useContext(DataContext);
  if (!ctx) {
    throw new Error("useData must be used within a DataProvider");
  }
  return ctx;
};

const ROLE_NAMES: Record<string, string[]> = {
  inbox: ["INBOX"],
  sent: ["Sent", "Sent Items", "[Gmail]/Sent Mail"],
  drafts: ["Drafts", "[Gmail]/Drafts"],
  trash: ["Trash", "Deleted Items", "[Gmail]/Trash"],
};

// Resolves the actual mailbox names served by the user's provider against
// well-known role hints (set by the IMAP \\Special-Use flags or, failing that,
// common folder names).
function resolveRoles(list: Mailbox[]): Record<string, string> {
  const byRole: Record<string, string> = {};
  for (const role of Object.keys(ROLE_NAMES)) {
    const exact = list.find((m) => m.role === role);
    if (exact) {
      byRole[role] = exact.name;
      continue;
    }
    const candidates = ROLE_NAMES[role];
    const match = list.find((m) =>
      candidates.some((c) => c.toLowerCase() === m.name.toLowerCase()),
    );
    if (match) byRole[role] = match.name;
  }
  return byRole;
}

function envelopeToThread(env: Envelope, mailbox: string): Thread {
  const participants: Participant[] = (env.from || []).map((a, i) => ({
    id: a.email || `from-${i}`,
    name: a.name || a.email || "",
    email: a.email || "",
  }));
  const unread = (env.flags || []).includes("\\Seen") ? 0 : 1;
  return {
    id: `${mailbox}:${env.uid}`,
    subject: env.subject || "(No subject)",
    participants,
    lastMessage: env.preview || "",
    lastMessageTime: env.date,
    unreadCount: unread,
    hasAttachment: !!env.has_attachments,
    mailbox,
    uid: env.uid,
  };
}

function parseThreadID(id: string): { mailbox: string; uid: number } | null {
  const idx = id.indexOf(":");
  if (idx <= 0) return null;
  const mailbox = id.slice(0, idx);
  const uid = Number(id.slice(idx + 1));
  if (!Number.isFinite(uid)) return null;
  return { mailbox, uid };
}

function messageToThreadMessage(m: Message): ThreadMessage {
  const sender = m.from?.[0];
  return {
    id: m.message_id || `msg-${m.uid}`,
    // Always supply a plain-text representation for screen readers, search,
    // and the case where the recipient blocks HTML rendering.
    content: m.body_text || stripHTML(m.body_html || ""),
    contentHtml: m.body_html || undefined,
    sender: {
      id: sender?.email || "unknown",
      name: sender?.name || sender?.email || "Unknown",
      email: sender?.email || "",
    },
    timestamp: m.date,
    isRead: (m.flags || []).includes("\\Seen"),
  };
}

// Lightweight HTML stripper for plain-text fallback. Not a sanitiser.
function stripHTML(s: string): string {
  return s
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

interface DataProviderProps {
  children: React.ReactNode;
}

export const DataProvider: React.FC<DataProviderProps> = ({ children }) => {
  const { apiClient, isAuthenticated } = useAuth();

  const [mailboxList, setMailboxList] = useState<Mailbox[]>([]);
  const [threads, setThreads] = useState<Thread[]>([]);
  const [sentThreads, setSentThreads] = useState<Thread[]>([]);
  const [drafts, setDrafts] = useState<Thread[]>([]);
  const [trashedThreads, setTrashedThreads] = useState<Thread[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Cache of role → mailbox name resolution so handlers can post to the right
  // folder without a fresh mailboxes call each time.
  const rolesRef = useRef<Record<string, string>>({});

  const loadAll = useCallback(
    async (signal?: AbortSignal): Promise<void> => {
      setLoading(true);
      setError(null);
      try {
        const resp = await mailboxesAPI.list(apiClient, signal);
        setMailboxList(resp.mailboxes || []);
        const roles = resolveRoles(resp.mailboxes || []);
        rolesRef.current = roles;

        // Use allSettled so a failure in one folder (e.g. a provider with no
        // "Drafts" mailbox, or a transient upstream error) doesn't wipe out
        // the successful folders' data.
        const settled = await Promise.allSettled([
          roles.inbox
            ? mailboxesAPI.listMessages(apiClient, roles.inbox, { limit: 50 }, signal)
            : Promise.resolve({ messages: [] }),
          roles.sent
            ? mailboxesAPI.listMessages(apiClient, roles.sent, { limit: 50 }, signal)
            : Promise.resolve({ messages: [] }),
          roles.drafts
            ? mailboxesAPI.listMessages(apiClient, roles.drafts, { limit: 50 }, signal)
            : Promise.resolve({ messages: [] }),
          roles.trash
            ? mailboxesAPI.listMessages(apiClient, roles.trash, { limit: 50 }, signal)
            : Promise.resolve({ messages: [] }),
        ]);

        const fold = (idx: number, mailbox: string | undefined) =>
          settled[idx].status === "fulfilled"
            ? ((settled[idx] as PromiseFulfilledResult<{ messages: Envelope[] }>).value
                .messages || []
              ).map((e) => envelopeToThread(e, mailbox || ""))
            : [];

        setThreads(fold(0, roles.inbox));
        setSentThreads(fold(1, roles.sent));
        setDrafts(fold(2, roles.drafts));
        setTrashedThreads(fold(3, roles.trash));

        const failed = settled
          .map((s, i) => ({ s, i }))
          .filter(({ s }) => s.status === "rejected");
        if (failed.length > 0) {
          const names = ["inbox", "sent", "drafts", "trash"];
          setError(
            `Could not load: ${failed.map(({ i }) => names[i]).join(", ")}`,
          );
        }
      } catch (err) {
        if ((err as { name?: string })?.name === "AbortError") return;
        setError((err as Error).message || "Failed to load mail");
      } finally {
        setLoading(false);
      }
    },
    [apiClient],
  );

  useEffect(() => {
    if (!isAuthenticated) {
      setThreads([]);
      setSentThreads([]);
      setDrafts([]);
      setTrashedThreads([]);
      setMailboxList([]);
      return;
    }
    const ctrl = new AbortController();
    void loadAll(ctrl.signal);
    return () => ctrl.abort();
  }, [isAuthenticated, loadAll]);

  const refresh = useCallback(() => loadAll(), [loadAll]);

  const allThreads = useMemo(
    () => [...threads, ...sentThreads, ...drafts, ...trashedThreads],
    [threads, sentThreads, drafts, trashedThreads],
  );

  const getThread = useCallback(
    (id: string): Thread | undefined => allThreads.find((t) => t.id === id),
    [allThreads],
  );

  const getMessages = useCallback(
    async (threadId: string): Promise<ThreadMessage[]> => {
      const parsed = parseThreadID(threadId);
      if (!parsed) return [];
      const msg = await messagesAPI.get(apiClient, parsed.mailbox, parsed.uid);
      return [messageToThreadMessage(msg)];
    },
    [apiClient],
  );

  const sendEmail = useCallback(
    async (data: EmailData) => {
      const result = await messagesAPI.send(apiClient, {
        to: data.to,
        cc: data.cc,
        bcc: data.bcc,
        subject: data.subject,
        body_text: data.body,
        body_html: data.bodyHtml,
        in_reply_to: data.inReplyTo,
        references: data.references,
      });
      // The newly-sent message will land in the Sent folder; pull a fresh list
      // so the user sees it without manually refreshing.
      if (rolesRef.current.sent) {
        const fresh = await mailboxesAPI.listMessages(
          apiClient,
          rolesRef.current.sent,
          { limit: 50 },
        );
        setSentThreads(
          (fresh.messages || []).map((e) =>
            envelopeToThread(e, rolesRef.current.sent),
          ),
        );
      }
      return result;
    },
    [apiClient],
  );

  const saveDraft = useCallback(
    async (data: DraftData): Promise<Thread> => {
      // The backend doesn't implement APPEND to Drafts yet; keep the legacy
      // local-only behaviour so the UI still works for in-progress composition.
      const draft: Thread = {
        id: `local-draft-${Date.now()}`,
        subject: data.subject || "(No subject)",
        participants: (data.to || []).map((a, i) => ({
          id: a.email || `to-${i}`,
          name: a.name || a.email || "",
          email: a.email || "",
        })),
        lastMessage: data.body || "",
        lastMessageTime: new Date().toISOString(),
        unreadCount: 0,
        hasAttachment: (data.attachments?.length || 0) > 0,
        mailbox: rolesRef.current.drafts || "Drafts",
        uid: 0,
      };
      setDrafts((prev) => [draft, ...prev]);
      return draft;
    },
    [],
  );

  const deleteThread = useCallback(
    async (threadId: string): Promise<void> => {
      const parsed = parseThreadID(threadId);
      if (!parsed) return;
      const trash = rolesRef.current.trash || "Trash";
      await messagesAPI.remove(apiClient, parsed.mailbox, parsed.uid, trash);
      const remove = (list: Thread[]) => list.filter((t) => t.id !== threadId);
      setThreads(remove);
      setSentThreads(remove);
      setDrafts(remove);
    },
    [apiClient],
  );

  const markAsRead = useCallback(
    async (threadId: string): Promise<void> => {
      const parsed = parseThreadID(threadId);
      if (!parsed) return;
      await messagesAPI.setFlags(
        apiClient,
        parsed.mailbox,
        parsed.uid,
        ["\\Seen"],
        true,
      );
      setThreads((prev) =>
        prev.map((t) => (t.id === threadId ? { ...t, unreadCount: 0 } : t)),
      );
    },
    [apiClient],
  );

  const sendMessage = useCallback(
    async (_threadId: string, content: string): Promise<ThreadMessage> => {
      // Reply-in-thread isn't wired through SMTP yet; surface the content
      // back so existing components don't break, and warn in the console.
      console.warn(
        "sendMessage is not yet implemented end-to-end; use sendEmail for new mail.",
      );
      return {
        id: `local-${Date.now()}`,
        content,
        sender: { id: "current", name: "You", email: "" },
        timestamp: new Date().toISOString(),
        isRead: true,
      };
    },
    [],
  );

  const unreadCount = useMemo(
    () => threads.reduce((acc, t) => acc + t.unreadCount, 0),
    [threads],
  );

  const contacts = useMemo<Participant[]>(() => {
    const seen = new Map<string, Participant>();
    for (const t of [...threads, ...sentThreads]) {
      for (const p of t.participants) {
        if (p.email && !seen.has(p.email)) seen.set(p.email, p);
      }
    }
    return Array.from(seen.values());
  }, [threads, sentThreads]);

  const value: DataContextValue = {
    mailboxes: mailboxList,
    threads,
    sentThreads,
    drafts,
    trashedThreads,
    contacts,
    loading,
    error,
    unreadCount,
    refresh,
    getThread,
    getMessages,
    sendEmail,
    saveDraft,
    deleteThread,
    markAsRead,
    sendMessage,
  };

  return <DataContext.Provider value={value}>{children}</DataContext.Provider>;
};

export default DataContext;
