// Endpoint functions grouped by resource. Each takes an APIClient and returns
// a typed Promise — keeping the network surface in one place makes mocking and
// future SWR-style caching easy to add.

import type { APIClient } from "./client";
import type {
  LoginRequest,
  LoginResponse,
  MailboxDelta,
  MailboxListResponse,
  Message,
  MessageListResponse,
  OutgoingMessage,
} from "./types";

const v1 = "/api/v1";

export const auth = {
  login(client: APIClient, req: LoginRequest) {
    return client.postUnauthed<LoginResponse>(`${v1}/auth/login`, req);
  },
  logout(client: APIClient) {
    return client.post<{ status: string }>(`${v1}/auth/logout`);
  },
};

export const mailboxes = {
  list(client: APIClient, signal?: AbortSignal) {
    return client.get<MailboxListResponse>(`${v1}/mailboxes`, signal);
  },
  listMessages(
    client: APIClient,
    mailbox: string,
    opts: { limit?: number; before?: number } = {},
    signal?: AbortSignal,
  ) {
    const params = new URLSearchParams();
    if (opts.limit) params.set("limit", String(opts.limit));
    if (opts.before) params.set("before", String(opts.before));
    const qs = params.toString();
    const path = `${v1}/mailboxes/${encodeURIComponent(mailbox)}/messages${
      qs ? `?${qs}` : ""
    }`;
    return client.get<MessageListResponse>(path, signal);
  },
  // Incremental sync (proposal §6): given the client's cached UIDVALIDITY and
  // the UIDs it already holds, return only what changed. `known` is sent as a
  // comma-separated UID list; the server derives the "since" watermark from it.
  changes(
    client: APIClient,
    mailbox: string,
    opts: { uidvalidity?: number; known?: number[]; limit?: number } = {},
    signal?: AbortSignal,
  ) {
    const params = new URLSearchParams();
    if (opts.uidvalidity) params.set("uidvalidity", String(opts.uidvalidity));
    if (opts.limit) params.set("limit", String(opts.limit));
    if (opts.known && opts.known.length) params.set("known", opts.known.join(","));
    const qs = params.toString();
    const path = `${v1}/mailboxes/${encodeURIComponent(mailbox)}/changes${
      qs ? `?${qs}` : ""
    }`;
    return client.get<MailboxDelta>(path, signal);
  },
};

export const messages = {
  get(client: APIClient, mailbox: string, uid: number, signal?: AbortSignal) {
    return client.get<Message>(
      `${v1}/mailboxes/${encodeURIComponent(mailbox)}/messages/${uid}`,
      signal,
    );
  },
  send(client: APIClient, msg: OutgoingMessage) {
    return client.post<{ status: string }>(`${v1}/messages`, msg);
  },
  setFlags(
    client: APIClient,
    mailbox: string,
    uid: number,
    flags: string[],
    add: boolean,
  ) {
    return client.patch<{ status: string }>(
      `${v1}/mailboxes/${encodeURIComponent(mailbox)}/messages/${uid}/flags`,
      { flags, add },
    );
  },
  remove(client: APIClient, mailbox: string, uid: number, trash?: string) {
    const body = trash ? { trash } : undefined;
    return client.delete<{ status: string }>(
      `${v1}/mailboxes/${encodeURIComponent(mailbox)}/messages/${uid}`,
      body,
    );
  },
};
