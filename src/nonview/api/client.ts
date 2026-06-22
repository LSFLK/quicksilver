// Typed fetch wrapper for the Quicksilver backend.
//
// Token handling is callback-based rather than module-level so the AuthContext
// stays the single source of truth for "am I logged in" — the client just asks.
// On 401 we invoke onUnauthorized so the context can drop the JWT and route to
// /login.

import type { APIErrorBody } from "./types";

export class APIError extends Error {
  readonly status: number;
  readonly code: string;

  constructor(status: number, code: string, message: string) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

interface ClientOptions {
  baseURL: string;
  getToken: () => string | null;
  onUnauthorized: () => void;
}

export class APIClient {
  private readonly baseURL: string;
  private readonly getToken: () => string | null;
  private readonly onUnauthorized: () => void;

  constructor(opts: ClientOptions) {
    // Strip a trailing slash so callers can safely write `${baseURL}/api/...`.
    this.baseURL = opts.baseURL.replace(/\/$/, "");
    this.getToken = opts.getToken;
    this.onUnauthorized = opts.onUnauthorized;
  }

  async request<T = unknown>(
    method: string,
    path: string,
    body?: unknown,
    options: { auth?: boolean; signal?: AbortSignal } = {},
  ): Promise<T> {
    const { auth = true, signal } = options;
    const headers: Record<string, string> = {};
    if (body !== undefined) {
      headers["Content-Type"] = "application/json";
    }
    if (auth) {
      const tok = this.getToken();
      if (tok) headers["Authorization"] = `Bearer ${tok}`;
    }

    const res = await fetch(`${this.baseURL}${path}`, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
      signal,
    });

    if (res.status === 204) {
      return undefined as T;
    }

    let payload: unknown = null;
    const ct = res.headers.get("content-type") || "";
    if (ct.includes("application/json")) {
      payload = await res.json().catch(() => null);
    } else {
      const text = await res.text().catch(() => "");
      payload = text ? { error: text } : null;
    }

    if (!res.ok) {
      const err = payload as APIErrorBody | null;
      if (res.status === 401 && auth) {
        // Tell the AuthContext to drop the stale session.
        this.onUnauthorized();
      }
      throw new APIError(
        res.status,
        err?.code || "unknown",
        err?.error || `request failed (${res.status})`,
      );
    }

    return payload as T;
  }

  get<T>(path: string, signal?: AbortSignal): Promise<T> {
    return this.request<T>("GET", path, undefined, { signal });
  }

  post<T>(path: string, body?: unknown, signal?: AbortSignal): Promise<T> {
    return this.request<T>("POST", path, body, { signal });
  }

  patch<T>(path: string, body?: unknown, signal?: AbortSignal): Promise<T> {
    return this.request<T>("PATCH", path, body, { signal });
  }

  delete<T>(path: string, body?: unknown, signal?: AbortSignal): Promise<T> {
    return this.request<T>("DELETE", path, body, { signal });
  }

  // Unauthenticated variant for the login call.
  postUnauthed<T>(path: string, body?: unknown): Promise<T> {
    return this.request<T>("POST", path, body, { auth: false });
  }

  // Builds an absolute URL for an SSE (EventSource) endpoint. The browser
  // EventSource API cannot set an Authorization header, so the JWT rides along
  // as the access_token query param, which the backend's RequireSession accepts.
  sseURL(path: string, params: Record<string, string> = {}): string {
    const qs = new URLSearchParams(params);
    const tok = this.getToken();
    if (tok) qs.set("access_token", tok);
    const query = qs.toString();
    return `${this.baseURL}${path}${query ? `?${query}` : ""}`;
  }
}

// Resolves the API base URL from Vite env, falling back to a same-origin /api
// proxy. Set VITE_API_BASE_URL to override (e.g. http://localhost:8080).
export function defaultBaseURL(): string {
  const envURL = (import.meta.env.VITE_API_BASE_URL as string | undefined) || "";
  if (envURL) return envURL;
  // Same-origin default: the Vite dev server / hosting proxies /api → backend.
  return "";
}
