import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useAccount } from "./AccountContext";
import { parseBody } from "./messageParser";
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
  AttachmentMeta,
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
  sourceThreadIds?: string[];
  // Source-level: this row came from the Trash folder listing.
  inTrash?: boolean;
  // Group-level: every source of this conversation is in Trash — the list
  // row shows it in its trashed state instead of dropping it.
  isTrashed?: boolean;
}

export interface ThreadMessage {
  id: string;
  sourceThreadId?: string;
  content: string;        // plain-text fallback
  contentHtml?: string;   // raw HTML from the upstream message; render only after sanitisation
  sender: Participant;
  // Addressing details for the participant hover-card. Bcc is not exposed by
  // IMAP for received mail, so only To/Cc are available.
  to?: Participant[];
  cc?: Participant[];
  timestamp: string;
  isRead: boolean;
  attachments?: AttachmentMeta[]; // downloadable attachment metadata (no bytes)
  // UI-side "in Trash" marker: the message was moved to Trash but stays
  // visible in the open conversation so it can be restored or purged.
  deleted?: boolean;
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
  emailThreads: Thread[];
  sentThreads: Thread[];
  drafts: Thread[];
  trashedThreads: Thread[];
  contacts: Participant[];
  loading: boolean;
  error: string | null;
  // True while the realtime SSE stream is connected (new mail pushes live).
  realtimeConnected: boolean;
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
  refreshActive: () => Promise<void>;
  // Delta-sync just one folder by role ("inbox" | "sent" | "drafts" | "trash").
  refreshFolder: (role: string) => Promise<void>;
  getThread: (id: string) => Thread | undefined;
  getMessages: (threadId: string) => Promise<ThreadMessage[]>;
  // Cache-first body read; returns null if nothing is cached for the thread.
  getCachedMessages: (threadId: string) => Promise<ThreadMessage[] | null>;
  // Speculatively fetch and cache a thread's body before the user opens it
  // (proposal §7, predictive prefetching). Best-effort, deduped, and a no-op
  // when the body is already cached.
  prefetchMessages: (threadId: string) => Promise<void>;
  // Fetch one attachment's bytes as a Blob (for in-app preview). Caller owns
  // the returned blob's object-URL lifecycle.
  fetchAttachment: (threadId: string, attachmentId: string) => Promise<Blob>;
  // Download one attachment of a thread's message to the user's device.
  downloadAttachment: (
    threadId: string,
    attachmentId: string,
    filename?: string,
  ) => Promise<void>;
  sendEmail: (data: EmailData) => Promise<{ status: string }>;
  saveDraft: (data: DraftData) => Promise<Thread>;
  deleteThread: (threadId: string) => Promise<void>;
  // Move one source thread ("mailbox:uid") to the account's Archive folder.
  // Rejects if the provider exposes no archive mailbox.
  archiveThread: (threadId: string) => Promise<void>;
  // Move a trashed message (looked up in Trash by its Message-ID header)
  // back to the inbox.
  restoreMessage: (messageId: string) => Promise<void>;
  // Permanently expunge a trashed message. Irreversible.
  deleteMessagePermanently: (messageId: string) => Promise<void>;
  markAsRead: (threadId: string) => Promise<void>;
  // Clear \Seen on one source thread ("mailbox:uid"), restoring its unread badge.
  markAsUnread: (threadId: string) => Promise<void>;
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
  archive: ["Archive", "Archives", "All Mail", "[Gmail]/All Mail"],
};

// How many envelopes to show per page (matches the backend default).
const PAGE_SIZE = 50;
const ACTIVE_ROLES = ["inbox", "sent", "drafts"];

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

function normalizeSubject(subject: string): string {
  const stripped = (subject || "")
    .replace(/^(\s*(re|fwd|fw)\s*:\s*)+/i, "")
    .replace(/\s+/g, " ")
    .trim();
  return (stripped || "(no subject)").toLowerCase();
}

const byTimestampAsc = (a: { timestamp: string }, b: { timestamp: string }): number =>
  new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime();

const byLastMessageDesc = (a: { lastMessageTime: string }, b: { lastMessageTime: string }): number =>
  new Date(b.lastMessageTime).getTime() - new Date(a.lastMessageTime).getTime();

function groupThreadsBySubject(sourceThreads: Thread[]): Thread[] {
  const groups = new Map<string, Thread[]>();
  for (const thread of sourceThreads) {
    const key = normalizeSubject(thread.subject);
    groups.set(key, [...(groups.get(key) || []), thread]);
  }

  return Array.from(groups.entries())
    .map(([key, groupedThreads]) => {
      const sorted = groupedThreads.slice().sort(byLastMessageDesc);
      const latest = sorted[0];
      const participants = new Map<string, Participant>();
      for (const thread of sorted) {
        for (const participant of thread.participants || []) {
          const participantKey = participant.email || participant.id;
          if (participantKey && !participants.has(participantKey)) {
            participants.set(participantKey, participant);
          }
        }
      }

      return {
        ...latest,
        id: `group:${encodeURIComponent(key)}`,
        subject: latest.subject || "(No subject)",
        participants: Array.from(participants.values()),
        unreadCount: sorted.reduce((count, thread) => count + thread.unreadCount, 0),
        hasAttachment: sorted.some((thread) => thread.hasAttachment),
        sourceThreadIds: sorted.map((thread) => thread.id),
        isTrashed: sorted.every((thread) => thread.inTrash),
      };
    })
    .sort(byLastMessageDesc);
}

function parseThreadID(id: string): { mailbox: string; uid: number } | null {
  const idx = id.indexOf(":");
  if (idx <= 0) return null;
  const mailbox = id.slice(0, idx);
  const uid = Number(id.slice(idx + 1));
  if (!Number.isFinite(uid)) return null;
  return { mailbox, uid };
}

function addressesToParticipants(addrs?: Address[]): Participant[] | undefined {
  if (!addrs || addrs.length === 0) return undefined;
  return addrs.map((a, i) => ({
    id: a.email || `addr-${i}`,
    name: a.name || a.email || "",
    email: a.email || "",
  }));
}

// Builds the UI-facing message from the API DTO. `content` is the plain-text
// representation — always supplied for screen readers, search, and the case
// where the recipient blocks HTML rendering — and is derived off the main
// thread by the parsing worker (see parseBody) before this is called.
function messageToThreadMessage(
  m: Message,
  content: string,
  sourceThreadId?: string,
): ThreadMessage {
  const sender = m.from?.[0];
  return {
    id: m.message_id || `msg-${m.uid}`,
    sourceThreadId,
    content,
    contentHtml: m.body_html || undefined,
    sender: {
      id: sender?.email || "unknown",
      name: sender?.name || sender?.email || "Unknown",
      email: sender?.email || "",
    },
    to: addressesToParticipants(m.to),
    cc: addressesToParticipants(m.cc),
    timestamp: m.date,
    isRead: (m.flags || []).includes("\\Seen"),
    attachments: m.attachments && m.attachments.length ? m.attachments : undefined,
  };
}

interface DataProviderProps {
  children: React.ReactNode;
}

export const DataProvider: React.FC<DataProviderProps> = ({ children }) => {
  const { apiClient, isAuthenticated, activeAccount } = useAccount();

  // Cache scope. Every IndexedDB read/write is namespaced by the active
  // account's id so a shared browser never mixes two accounts' mail.
  const account = activeAccount?.id || "";

  const [mailboxList, setMailboxList] = useState<Mailbox[]>([]);
  const [threads, setThreads] = useState<Thread[]>([]);
  const [sentThreads, setSentThreads] = useState<Thread[]>([]);
  const [drafts, setDrafts] = useState<Thread[]>([]);
  const [trashedThreads, setTrashedThreads] = useState<Thread[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Resolved INBOX name (provider-specific). Held in state so the realtime
  // effect can (re)open the SSE stream once the mailbox list is known.
  const [inboxName, setInboxName] = useState<string>("");
  // Whether the realtime SSE stream is currently connected.
  const [realtimeConnected, setRealtimeConnected] = useState(false);

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
        setInboxName(roles.inbox || "");

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
    // Clear the previous account's in-memory state before hydrating the new
    // one. hydrateFromCache only *sets* state for folders that have cached
    // rows, so without this an account switch to a cold cache would leave
    // the previous account's threads on screen until loadAll's network call
    // resolves. Clearing inboxName also forces the realtime effect below to
    // close the old account's EventSource and reopen a fresh one once the
    // new account's inbox name resolves, rather than keeping a stale
    // connection alive under the new account's identity.
    setThreads([]);
    setSentThreads([]);
    setDrafts([]);
    setTrashedThreads([]);
    setMailboxList([]);
    setPage({});
    setTotal({});
    setPageLoading({});
    pageCursors.current = {};
    rolesRef.current = {};
    setInboxName("");

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
      next.sort(byLastMessageDesc);
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

  const refreshActive = useCallback(async (): Promise<void> => {
    if (Object.keys(rolesRef.current).length === 0) {
      await loadAll();
      return;
    }
    setError(null);
    const results = await Promise.allSettled(
      ACTIVE_ROLES.map((role) => syncRole(role)),
    );
    const failed = results
      .map((s, i) => ({ s, role: ACTIVE_ROLES[i] }))
      .filter(({ s }) => s.status === "rejected");
    if (failed.length > 0) {
      setError(`Could not sync: ${failed.map(({ role }) => role).join(", ")}`);
    }
  }, [loadAll, syncRole]);

  // Keep a live reference to syncRole so the realtime effect can call the
  // latest version without re-subscribing the SSE stream every time syncRole's
  // identity changes (which would needlessly tear down the IMAP IDLE watcher).
  const syncRoleRef = useRef(syncRole);
  useEffect(() => {
    syncRoleRef.current = syncRole;
  }, [syncRole]);

  // Realtime push (proposal §6, Phase 4). Open one SSE stream that watches the
  // inbox; when the gateway's IMAP IDLE connection reports a change it pushes a
  // tiny "changed" event, and we run a delta sync for the affected folder. The
  // event carries only the mailbox name — the actual delta is pulled over the
  // regular sync path, so the push stays lightweight.
  useEffect(() => {
    if (!isAuthenticated || !inboxName) return;

    const url = apiClient.sseURL("/api/v1/events", { mailbox: inboxName });
    const es = new EventSource(url);

    // Coalesce bursts of IDLE updates (e.g. a flag change + arrival) into one
    // sync per folder.
    const timers: Record<string, ReturnType<typeof setTimeout>> = {};
    const scheduleSync = (role: string) => {
      if (timers[role]) clearTimeout(timers[role]);
      timers[role] = setTimeout(() => {
        delete timers[role];
        void syncRoleRef.current(role);
      }, 60);
    };

    const onOpen = () => setRealtimeConnected(true);
    const onError = () => setRealtimeConnected(false); // EventSource auto-reconnects
    const onChanged = (e: MessageEvent) => {
      let mailbox = inboxName;
      try {
        mailbox = (JSON.parse(e.data) as { mailbox?: string }).mailbox || inboxName;
      } catch {
        // Malformed payload — fall back to syncing the inbox.
      }
      // Map the mailbox name back to a role; default to inbox.
      const entry = Object.entries(rolesRef.current).find(
        ([, name]) => name === mailbox,
      );
      scheduleSync(entry ? entry[0] : "inbox");
    };

    es.addEventListener("open", onOpen);
    es.addEventListener("error", onError);
    es.addEventListener("changed", onChanged as EventListener);

    return () => {
      for (const t of Object.values(timers)) clearTimeout(t);
      es.removeEventListener("changed", onChanged as EventListener);
      es.close();
      setRealtimeConnected(false);
    };
  }, [isAuthenticated, apiClient, inboxName]);

  const allThreads = useMemo(
    () => [...threads, ...sentThreads, ...drafts, ...trashedThreads],
    [threads, sentThreads, drafts, trashedThreads],
  );

  // Trash sources join the grouped list (tagged) so deleting a message keeps
  // its conversation visible in the mail view, shown in a trashed state.
  const emailThreads = useMemo(
    () =>
      groupThreadsBySubject([
        ...threads,
        ...sentThreads,
        ...drafts,
        ...trashedThreads.map((t) => ({ ...t, inTrash: true })),
      ]),
    [threads, sentThreads, drafts, trashedThreads],
  );

  // O(1) id lookups — resolveThreadIds/getThread are called on every list
  // hover (prefetch) and render, so a linear .find() over the full list would
  // be O(n) per call.
  const emailThreadsById = useMemo(
    () => new Map(emailThreads.map((t) => [t.id, t])),
    [emailThreads],
  );
  const threadsById = useMemo(() => {
    const map = new Map(allThreads.map((t) => [t.id, t]));
    emailThreads.forEach((t) => map.set(t.id, t));
    return map;
  }, [allThreads, emailThreads]);

  const resolveThreadIds = useCallback(
    (threadId: string): string[] => {
      const grouped = emailThreadsById.get(threadId);
      return grouped?.sourceThreadIds?.length ? grouped.sourceThreadIds : [threadId];
    },
    [emailThreadsById],
  );

  const getThread = useCallback(
    (id: string): Thread | undefined => threadsById.get(id),
    [threadsById],
  );

  const getMessages = useCallback(
    async (threadId: string): Promise<ThreadMessage[]> => {
      const threadIds = resolveThreadIds(threadId);
      // Fetch from the network and refresh the cache. Body text extraction runs
      // in the parsing worker so a large HTML email doesn't jank the read view.
      const trashName = rolesRef.current.trash || "Trash";
      const messages = await Promise.all(
        threadIds.map(async (sourceThreadId) => {
          const parsed = parseThreadID(sourceThreadId);
          if (!parsed) return null;
          const msg = await messagesAPI.get(apiClient, parsed.mailbox, parsed.uid);
          const content = await parseBody(msg.body_text, msg.body_html);
          const tm = messageToThreadMessage(msg, content, sourceThreadId);
          // A message sourced from the Trash folder renders in its "In Trash"
          // state (restorable / purgeable) instead of as a normal message.
          if (parsed.mailbox === trashName) tm.deleted = true;
          void writeBody(account, sourceThreadId, tm);
          return tm;
        }),
      );
      return messages
        .filter((message): message is ThreadMessage => Boolean(message))
        .sort(byTimestampAsc);
    },
    [apiClient, account, resolveThreadIds],
  );

  // In-flight prefetch guard: dedupes concurrent prefetch requests for the same
  // thread so hover + top-of-list prefetch never double-fetch the same body.
  const prefetching = useRef<Set<string>>(new Set());

  const prefetchMessages = useCallback(
    async (threadId: string): Promise<void> => {
      if (prefetching.current.has(threadId)) return;

      prefetching.current.add(threadId);
      try {
        await Promise.all(
          resolveThreadIds(threadId).map(async (sourceThreadId) => {
            const parsed = parseThreadID(sourceThreadId);
            // Skip local-only drafts (uid 0), malformed ids, and cached bodies.
            if (!parsed || parsed.uid <= 0) return;
            if (await readBody(account, sourceThreadId)) return;
            const msg = await messagesAPI.get(apiClient, parsed.mailbox, parsed.uid);
            const content = await parseBody(msg.body_text, msg.body_html);
            await writeBody(
              account,
              sourceThreadId,
              messageToThreadMessage(msg, content, sourceThreadId),
            );
          }),
        );
      } catch {
        // Prefetch is best-effort; a failure just means the real open pays the
        // network cost as usual.
      } finally {
        prefetching.current.delete(threadId);
      }
    },
    [apiClient, account, resolveThreadIds],
  );

  const fetchAttachment = useCallback(
    async (threadId: string, attachmentId: string): Promise<Blob> => {
      const parsed = parseThreadID(threadId);
      if (!parsed || parsed.uid <= 0) {
        throw new Error("attachment unavailable for this message");
      }
      return messagesAPI.attachment(
        apiClient,
        parsed.mailbox,
        parsed.uid,
        attachmentId,
      );
    },
    [apiClient],
  );

  const downloadAttachment = useCallback(
    async (
      threadId: string,
      attachmentId: string,
      filename?: string,
    ): Promise<void> => {
      const blob = await fetchAttachment(threadId, attachmentId);
      // Save the blob via a transient object URL + anchor click, then revoke to
      // free the memory. This keeps the auth header on the request (a plain
      // <a href> to the API couldn't send the Bearer token).
      const url = URL.createObjectURL(blob);
      try {
        const a = document.createElement("a");
        a.href = url;
        a.download = filename || "attachment";
        document.body.appendChild(a);
        a.click();
        a.remove();
      } finally {
        // Revoke on the next tick so the download has grabbed the URL first.
        setTimeout(() => URL.revokeObjectURL(url), 0);
      }
    },
    [fetchAttachment],
  );

  // Cache-first body read for the read view: returns the cached body instantly
  // (or null on a cold thread) so ThreadPage can paint before the network
  // round-trip completes, then revalidate via getMessages.
  const getCachedMessages = useCallback(
    async (threadId: string): Promise<ThreadMessage[] | null> => {
      const trashName = rolesRef.current.trash || "Trash";
      const cached = await Promise.all(
        resolveThreadIds(threadId).map(async (sourceThreadId): Promise<ThreadMessage | null> => {
          const message = await readBody(account, sourceThreadId);
          if (!message) return null;
          const parsed = parseThreadID(sourceThreadId);
          return {
            ...message,
            sourceThreadId,
            deleted: parsed?.mailbox === trashName || undefined,
          };
        }),
      );
      const messages = cached
        .filter((message): message is ThreadMessage => Boolean(message))
        .sort(byTimestampAsc);
      return messages.length ? messages : null;
    },
    [account, resolveThreadIds],
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
      // The message now lives in Trash. Re-sync the source folder (the row
      // leaves it) and Trash (the row joins it) — because trash sources feed
      // the grouped list, the conversation stays visible in its trashed state
      // rather than disappearing.
      const entry = Object.entries(rolesRef.current).find(
        ([, name]) => name === parsed.mailbox,
      );
      await Promise.allSettled([
        syncRole(entry ? entry[0] : "inbox"),
        syncRole("trash"),
      ]);
    },
    [apiClient, syncRole],
  );

  // Move one source thread to the Archive mailbox. Same optimistic pattern as
  // deleteThread: drop the row immediately, roll back if the server move fails.
  const archiveThread = useCallback(
    async (threadId: string): Promise<void> => {
      const parsed = parseThreadID(threadId);
      if (!parsed) return;
      const archive =
        rolesRef.current.archive ||
        mailboxList.find((m) => m.role === "archive")?.name;
      if (!archive) {
        throw new Error("This account has no archive folder");
      }

      const snapshot = { threads, sentThreads, drafts };
      const remove = (list: Thread[]) => list.filter((t) => t.id !== threadId);
      setThreads(remove);
      setSentThreads(remove);
      setDrafts(remove);
      void removeThread(account, threadId);

      try {
        await messagesAPI.remove(apiClient, parsed.mailbox, parsed.uid, archive);
      } catch (err) {
        setThreads(snapshot.threads);
        setSentThreads(snapshot.sentThreads);
        setDrafts(snapshot.drafts);
        void writeThreads(account, "inbox", snapshot.threads);
        throw err;
      }
    },
    [apiClient, account, mailboxList, threads, sentThreads, drafts],
  );

  const markAsRead = useCallback(
    async (threadId: string): Promise<void> => {
      const threadIds = resolveThreadIds(threadId);
      const ids = new Set(threadIds);
      const setUnread = (n: number) =>
        [setThreads, setSentThreads, setDrafts, setTrashedThreads].forEach((set) =>
          set((prev) => prev.map((t) => (ids.has(t.id) ? { ...t, unreadCount: n } : t))),
        );

      // Optimistic: clear the unread badge instantly in state and cache.
      setUnread(0);
      threadIds.forEach((id) => void patchThread(account, id, { unreadCount: 0 }));

      try {
        await Promise.all(
          threadIds.map(async (id) => {
            const parsed = parseThreadID(id);
            if (!parsed) return;
            await messagesAPI.setFlags(
              apiClient,
              parsed.mailbox,
              parsed.uid,
              ["\\Seen"],
              true,
            );
          }),
        );
      } catch (err) {
        // Restore the unread badge if the flag update didn't stick.
        setUnread(1);
        threadIds.forEach((id) => void patchThread(account, id, { unreadCount: 1 }));
        throw err;
      }
    },
    [apiClient, account, resolveThreadIds],
  );

  // Move a trashed message back to the inbox. The message's UID changed when
  // it was moved to Trash, so it's located there by Message-ID first; the
  // generic move endpoint then carries it to the inbox. Both folders are
  // re-synced so the restored row reappears in the list.
  const restoreMessage = useCallback(
    async (messageId: string): Promise<void> => {
      const trash = rolesRef.current.trash || "Trash";
      const inbox = rolesRef.current.inbox || "INBOX";
      const { uid } = await messagesAPI.find(apiClient, trash, messageId);
      await messagesAPI.remove(apiClient, trash, uid, inbox);
      await Promise.allSettled([syncRole("inbox"), syncRole("trash")]);
    },
    [apiClient, syncRole],
  );

  // Permanently expunge a trashed message. Irreversible — callers should
  // confirm with the user first.
  const deleteMessagePermanently = useCallback(
    async (messageId: string): Promise<void> => {
      const trash = rolesRef.current.trash || "Trash";
      const { uid } = await messagesAPI.find(apiClient, trash, messageId);
      await messagesAPI.removePermanent(apiClient, trash, uid);
      void syncRole("trash");
    },
    [apiClient, syncRole],
  );

  // Clear \Seen on one source thread, restoring its unread badge. Optimistic,
  // mirroring markAsRead.
  const markAsUnread = useCallback(
    async (threadId: string): Promise<void> => {
      const parsed = parseThreadID(threadId);
      if (!parsed || parsed.uid <= 0) return;
      const setUnread = (n: number) =>
        [setThreads, setSentThreads, setDrafts, setTrashedThreads].forEach((set) =>
          set((prev) =>
            prev.map((t) => (t.id === threadId ? { ...t, unreadCount: n } : t)),
          ),
        );

      setUnread(1);
      void patchThread(account, threadId, { unreadCount: 1 });

      try {
        await messagesAPI.setFlags(
          apiClient,
          parsed.mailbox,
          parsed.uid,
          ["\\Seen"],
          false,
        );
      } catch (err) {
        setUnread(0);
        void patchThread(account, threadId, { unreadCount: 0 });
        throw err;
      }
    },
    [apiClient, account],
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

  const value = useMemo<DataContextValue>(
    () => ({
      mailboxes: mailboxList,
      threads,
      emailThreads,
      sentThreads,
      drafts,
      trashedThreads,
      contacts,
      loading,
      error,
      realtimeConnected,
      unreadCount,
      page,
      total,
      pageLoading,
      pageSize: PAGE_SIZE,
      nextPage,
      prevPage,
      refresh,
      refreshActive,
      refreshFolder,
      getThread,
      getMessages,
      getCachedMessages,
      prefetchMessages,
      fetchAttachment,
      downloadAttachment,
      sendEmail,
      saveDraft,
      deleteThread,
      archiveThread,
      restoreMessage,
      deleteMessagePermanently,
      markAsRead,
      markAsUnread,
    }),
    [
      mailboxList,
      threads,
      emailThreads,
      sentThreads,
      drafts,
      trashedThreads,
      contacts,
      loading,
      error,
      realtimeConnected,
      unreadCount,
      page,
      total,
      pageLoading,
      nextPage,
      prevPage,
      refresh,
      refreshActive,
      refreshFolder,
      getThread,
      getMessages,
      getCachedMessages,
      prefetchMessages,
      fetchAttachment,
      downloadAttachment,
      sendEmail,
      saveDraft,
      deleteThread,
      archiveThread,
      restoreMessage,
      deleteMessagePermanently,
      markAsRead,
      markAsUnread,
    ],
  );

  return <DataContext.Provider value={value}>{children}</DataContext.Provider>;
};

export default DataContext;
