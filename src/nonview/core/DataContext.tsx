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
import {
  readThreads,
  writeThreads,
  removeThread,
  patchThread,
  readBody,
  writeBody,
  readUidValidity,
  writeUidValidity,
} from "../cache/db";
import type {
  Address,
  Envelope,
  Mailbox,
  Message,
  MessageListResponse,
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
  // Page-based pagination keyed by role ("inbox" | "sent" | "drafts" | "trash").
  // page[role] is the 0-based current page; total[role] is the mailbox's full
  // message count; pageLoading[role] is true while a page is being fetched.
  page: Record<string, number>;
  total: Record<string, number>;
  pageLoading: Record<string, boolean>;
  pageSize: number;
  // Move one page older / newer, replacing the folder's visible messages.
  nextPage: (role: string) => Promise<void>;
  prevPage: (role: string) => Promise<void>;
  refresh: () => Promise<void>;
  // Delta-sync just one folder by role ("inbox" | "sent" | "drafts" | "trash").
  refreshFolder: (role: string) => Promise<void>;
  getThread: (id: string) => Thread | undefined;
  getMessages: (threadId: string) => Promise<ThreadMessage[]>;
  // Cache-first body read; returns null if nothing is cached for the thread.
  getCachedMessages: (threadId: string) => Promise<ThreadMessage[] | null>;
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

// How many envelopes to show per page (matches the backend default).
const PAGE_SIZE = 50;

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
  const { apiClient, isAuthenticated, currentUser } = useAuth();

  // Cache scope. Every IndexedDB read/write is namespaced by the signed-in
  // address so a shared browser never mixes two accounts' mail.
  const account = currentUser?.email || "";

  const [mailboxList, setMailboxList] = useState<Mailbox[]>([]);
  const [threads, setThreads] = useState<Thread[]>([]);
  const [sentThreads, setSentThreads] = useState<Thread[]>([]);
  const [drafts, setDrafts] = useState<Thread[]>([]);
  const [trashedThreads, setTrashedThreads] = useState<Thread[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Pagination bookkeeping per folder role.
  const [page, setPage] = useState<Record<string, number>>({});
  const [total, setTotal] = useState<Record<string, number>>({});
  const [pageLoading, setPageLoading] = useState<Record<string, boolean>>({});
  // pageCursors[role][i] is the `before` UID used to fetch page i (index 0 is
  // undefined = newest). Discovered as the user pages forward, reused for back.
  const pageCursors = useRef<Record<string, (number | undefined)[]>>({});

  // Cache of role → mailbox name resolution so handlers can post to the right
  // folder without a fresh mailboxes call each time.
  const rolesRef = useRef<Record<string, string>>({});

  // Paint the mailbox list from IndexedDB before any network call. Returns
  // whether the cache held anything, so the network load knows whether it
  // still needs to show a blocking spinner (cold start) or can refresh quietly.
  const hydrateFromCache = useCallback(async (): Promise<boolean> => {
    if (!account) return false;
    const [inbox, sent, draftsC, trash] = await Promise.all([
      readThreads(account, "inbox"),
      readThreads(account, "sent"),
      readThreads(account, "drafts"),
      readThreads(account, "trash"),
    ]);
    if (inbox.length) setThreads(inbox);
    if (sent.length) setSentThreads(sent);
    if (draftsC.length) setDrafts(draftsC);
    if (trash.length) setTrashedThreads(trash);
    return (
      inbox.length + sent.length + draftsC.length + trash.length > 0
    );
  }, [account]);

  const loadAll = useCallback(
    async (
      signal?: AbortSignal,
      opts: { showSpinner?: boolean } = {},
    ): Promise<void> => {
      // On a warm cache we refresh in the background — no blocking spinner.
      if (opts.showSpinner !== false) setLoading(true);
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
            ? mailboxesAPI.listMessages(apiClient, roles.inbox, { limit: PAGE_SIZE }, signal)
            : Promise.resolve({ messages: [] }),
          roles.sent
            ? mailboxesAPI.listMessages(apiClient, roles.sent, { limit: PAGE_SIZE }, signal)
            : Promise.resolve({ messages: [] }),
          roles.drafts
            ? mailboxesAPI.listMessages(apiClient, roles.drafts, { limit: PAGE_SIZE }, signal)
            : Promise.resolve({ messages: [] }),
          roles.trash
            ? mailboxesAPI.listMessages(apiClient, roles.trash, { limit: PAGE_SIZE }, signal)
            : Promise.resolve({ messages: [] }),
        ]);

        // Apply a folder's fresh first page (page 0) to React state and the
        // cache, and seed its pagination bookkeeping — but only when the fetch
        // succeeded, so a rejected fetch never clobbers good cached rows.
        const apply = (
          idx: number,
          role: string,
          mailbox: string | undefined,
          set: React.Dispatch<React.SetStateAction<Thread[]>>,
        ) => {
          if (settled[idx].status !== "fulfilled") return; // keep cached rows
          const val = (settled[idx] as PromiseFulfilledResult<MessageListResponse>).value;
          const msgs = val.messages || [];
          const fresh = msgs.map((e) => envelopeToThread(e, mailbox || ""));
          set(fresh);
          void writeThreads(account, role, fresh);
          // Persist UIDVALIDITY so a later refresh can sync via a delta.
          if (val.uidvalidity) void writeUidValidity(account, role, val.uidvalidity);
          // Reset to page 0; cursor for page 1 is this page's next_before.
          pageCursors.current[role] = [undefined, val.next_before];
          setPage((p) => ({ ...p, [role]: 0 }));
          setTotal((t) => ({ ...t, [role]: val.total ?? msgs.length }));
        };

        apply(0, "inbox", roles.inbox, setThreads);
        apply(1, "sent", roles.sent, setSentThreads);
        apply(2, "drafts", roles.drafts, setDrafts);
        apply(3, "trash", roles.trash, setTrashedThreads);

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
    [apiClient, account],
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
    // Cache-first: paint from IndexedDB immediately, then refresh from the
    // network without a blocking spinner if the cache already had something.
    void (async () => {
      const hadCache = await hydrateFromCache();
      await loadAll(ctrl.signal, { showSpinner: !hadCache });
    })();
    return () => ctrl.abort();
  }, [isAuthenticated, loadAll, hydrateFromCache]);

  // `refresh` is defined below, after the pagination helpers it depends on.

  // Maps a role to its current thread array's state setter.
  const setterForRole = useCallback(
    (role: string): React.Dispatch<React.SetStateAction<Thread[]>> | null => {
      switch (role) {
        case "inbox":
          return setThreads;
        case "sent":
          return setSentThreads;
        case "trash":
          return setTrashedThreads;
        case "drafts":
          return setDrafts;
        default:
          return null;
      }
    },
    [],
  );

  // Fetch one page of a folder and REPLACE the visible messages with it (unlike
  // infinite scroll, which appends). `target` is the destination page index;
  // `before` is the cursor for that page (undefined = newest/page 0).
  const fetchPage = useCallback(
    async (role: string, target: number, before: number | undefined): Promise<void> => {
      const mailbox = rolesRef.current[role];
      const set = setterForRole(role);
      if (!mailbox || !set) return;

      setPageLoading((m) => ({ ...m, [role]: true }));
      try {
        const resp = await mailboxesAPI.listMessages(apiClient, mailbox, {
          limit: PAGE_SIZE,
          ...(before ? { before } : {}),
        });
        const msgs = resp.messages || [];
        const fresh = msgs.map((e) => envelopeToThread(e, mailbox));
        set(fresh);
        setPage((p) => ({ ...p, [role]: target }));
        if (resp.total !== undefined) {
          setTotal((t) => ({ ...t, [role]: resp.total as number }));
        }
        // Record the cursor for the *next* page so a later nextPage knows it.
        const cursors = pageCursors.current[role] || [undefined];
        cursors[target + 1] = resp.next_before;
        pageCursors.current[role] = cursors;
        // Only page 0 is mirrored to the offline cache (the "newest" view).
        if (target === 0) {
          void writeThreads(account, role, fresh);
          if (resp.uidvalidity) void writeUidValidity(account, role, resp.uidvalidity);
        }
      } catch (err) {
        if ((err as { name?: string })?.name !== "AbortError") {
          setError((err as Error).message || "Failed to load page");
        }
      } finally {
        setPageLoading((m) => ({ ...m, [role]: false }));
      }
    },
    [apiClient, account, setterForRole],
  );

  const nextPage = useCallback(
    async (role: string): Promise<void> => {
      if (pageLoading[role]) return;
      const cur = page[role] ?? 0;
      const target = cur + 1;
      // Don't page past the end.
      if (target * PAGE_SIZE >= (total[role] ?? 0)) return;
      const before = (pageCursors.current[role] || [])[target];
      await fetchPage(role, target, before);
    },
    [page, total, pageLoading, fetchPage],
  );

  const prevPage = useCallback(
    async (role: string): Promise<void> => {
      if (pageLoading[role]) return;
      const cur = page[role] ?? 0;
      if (cur <= 0) return;
      const target = cur - 1;
      const before = (pageCursors.current[role] || [])[target];
      await fetchPage(role, target, before);
    },
    [page, pageLoading, fetchPage],
  );

  // Incremental sync for one folder (proposal §6). Diffs the cached page-0 view
  // against the server and applies only added/removed/flag-changed messages,
  // instead of re-listing the whole page. Falls back to a full page-0 fetch when
  // there's no baseline to diff against, or when the server signals a resync
  // (UIDVALIDITY changed → cached UIDs are stale).
  const syncRole = useCallback(
    async (role: string): Promise<void> => {
      const mailbox = rolesRef.current[role];
      const set = setterForRole(role);
      if (!mailbox || !set) return;

      const cached = await readThreads(account, role);
      const known = cached.map((t) => t.uid).filter((u) => u > 0);
      const uidvalidity = await readUidValidity(account, role);
      // Cold folder or unknown UIDVALIDITY → nothing to diff; do a full fetch.
      if (!uidvalidity || known.length === 0) {
        await fetchPage(role, 0, undefined);
        return;
      }

      const delta = await mailboxesAPI.changes(apiClient, mailbox, {
        uidvalidity,
        known,
        limit: PAGE_SIZE,
      });
      if (delta.resync) {
        await fetchPage(role, 0, undefined);
        return;
      }

      // Reconcile against the cached baseline, keyed on UID and applied
      // idempotently so repeated syncs converge to the same result.
      let next = cached.slice();

      if (delta.removed?.length) {
        const gone = new Set(delta.removed);
        next = next.filter((t) => !gone.has(t.uid));
      }
      if (delta.flags?.length) {
        const flagsByUid = new Map(delta.flags.map((f) => [f.uid, f.flags]));
        next = next.map((t) => {
          const fl = flagsByUid.get(t.uid);
          if (!fl) return t;
          const unread = fl.includes("\\Seen") ? 0 : 1;
          return unread === t.unreadCount ? t : { ...t, unreadCount: unread };
        });
      }
      if (delta.added?.length) {
        const have = new Set(next.map((t) => t.uid));
        const fresh = delta.added
          .filter((e) => !have.has(e.uid))
          .map((e) => envelopeToThread(e, mailbox));
        next = [...fresh, ...next];
      }

      // Keep the newest-first page-0 window.
      next.sort(
        (a, b) =>
          new Date(b.lastMessageTime).getTime() -
          new Date(a.lastMessageTime).getTime(),
      );
      if (next.length > PAGE_SIZE) next = next.slice(0, PAGE_SIZE);

      set(next);
      void writeThreads(account, role, next);
      void writeUidValidity(account, role, delta.uidvalidity);
      setPage((p) => ({ ...p, [role]: 0 }));
      setTotal((t) => ({ ...t, [role]: delta.total }));
      // Cursor for page 1 is the oldest UID currently shown.
      const oldestUid = next.reduce(
        (min, t) => (t.uid > 0 && t.uid < min ? t.uid : min),
        Number.MAX_SAFE_INTEGER,
      );
      pageCursors.current[role] = [
        undefined,
        oldestUid === Number.MAX_SAFE_INTEGER ? undefined : oldestUid,
      ];
    },
    [apiClient, account, setterForRole, fetchPage],
  );

  // Delta-sync a single folder — the one the user is looking at. Scoping the
  // refresh to one folder avoids contending four mailbox syncs on the session's
  // single IMAP connection (they would otherwise serialise on its mutex, each
  // paying a full SELECT). Falls back to a full load if roles aren't resolved
  // yet (refresh raced ahead of the initial load).
  const refreshFolder = useCallback(
    async (role: string): Promise<void> => {
      if (!rolesRef.current[role]) {
        await loadAll();
        return;
      }
      setError(null);
      try {
        await syncRole(role);
      } catch (err) {
        if ((err as { name?: string })?.name !== "AbortError") {
          setError((err as Error).message || `Could not sync ${role}`);
        }
      }
    },
    [loadAll, syncRole],
  );

  // Refresh every folder (e.g. a global "sync all"). Pages use refreshFolder for
  // their own folder; this is kept for callers that genuinely want all of them.
  const refresh = useCallback(async (): Promise<void> => {
    if (Object.keys(rolesRef.current).length === 0) {
      await loadAll();
      return;
    }
    setError(null);
    const roles = ["inbox", "sent", "drafts", "trash"];
    const results = await Promise.allSettled(roles.map((role) => syncRole(role)));
    const failed = results
      .map((s, i) => ({ s, role: roles[i] }))
      .filter(({ s }) => s.status === "rejected");
    if (failed.length > 0) {
      setError(`Could not sync: ${failed.map(({ role }) => role).join(", ")}`);
    }
  }, [loadAll, syncRole]);

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
      // Fetch from the network and refresh the cache.
      const msg = await messagesAPI.get(apiClient, parsed.mailbox, parsed.uid);
      const tm = messageToThreadMessage(msg);
      void writeBody(account, threadId, tm);
      return [tm];
    },
    [apiClient, account],
  );

  // Cache-first body read for the read view: returns the cached body instantly
  // (or null on a cold thread) so ThreadPage can paint before the network
  // round-trip completes, then revalidate via getMessages.
  const getCachedMessages = useCallback(
    async (threadId: string): Promise<ThreadMessage[] | null> => {
      const cached = await readBody(account, threadId);
      return cached ? [cached] : null;
    },
    [account],
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

      // Optimistic: remove from the list (and cache) immediately, then call the
      // server. Snapshot first so we can roll back if the delete fails.
      const snapshot = { threads, sentThreads, drafts };
      const remove = (list: Thread[]) => list.filter((t) => t.id !== threadId);
      setThreads(remove);
      setSentThreads(remove);
      setDrafts(remove);
      void removeThread(account, threadId);

      try {
        await messagesAPI.remove(apiClient, parsed.mailbox, parsed.uid, trash);
      } catch (err) {
        // Roll back to the pre-delete state on failure.
        setThreads(snapshot.threads);
        setSentThreads(snapshot.sentThreads);
        setDrafts(snapshot.drafts);
        void writeThreads(account, "inbox", snapshot.threads);
        throw err;
      }
    },
    [apiClient, account, threads, sentThreads, drafts],
  );

  const markAsRead = useCallback(
    async (threadId: string): Promise<void> => {
      const parsed = parseThreadID(threadId);
      if (!parsed) return;

      // Optimistic: clear the unread badge instantly in state and cache.
      setThreads((prev) =>
        prev.map((t) => (t.id === threadId ? { ...t, unreadCount: 0 } : t)),
      );
      void patchThread(account, threadId, { unreadCount: 0 });

      try {
        await messagesAPI.setFlags(
          apiClient,
          parsed.mailbox,
          parsed.uid,
          ["\\Seen"],
          true,
        );
      } catch (err) {
        // Restore the unread badge if the flag update didn't stick.
        setThreads((prev) =>
          prev.map((t) =>
            t.id === threadId ? { ...t, unreadCount: 1 } : t,
          ),
        );
        void patchThread(account, threadId, { unreadCount: 1 });
        throw err;
      }
    },
    [apiClient, account],
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
    page,
    total,
    pageLoading,
    pageSize: PAGE_SIZE,
    nextPage,
    prevPage,
    refresh,
    refreshFolder,
    getThread,
    getMessages,
    getCachedMessages,
    sendEmail,
    saveDraft,
    deleteThread,
    markAsRead,
    sendMessage,
  };

  return <DataContext.Provider value={value}>{children}</DataContext.Provider>;
};

export default DataContext;
