/* API client with automatic refresh-token rotation.
 * The base URL is inlined at build time via NEXT_PUBLIC_API_URL. */
export const API_BASE = process.env.NEXT_PUBLIC_API_URL || "";

export interface ApiError extends Error {
  status?: number;
  code?: string;
}

interface Session {
  token: string;
  refreshToken: string;
}

const SESSION_KEY = "pf_session";

export function loadSession(): Session | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    return raw ? (JSON.parse(raw) as Session) : null;
  } catch {
    return null;
  }
}

export function saveSession(s: Session) {
  localStorage.setItem(SESSION_KEY, JSON.stringify(s));
}

export function clearSession() {
  localStorage.removeItem(SESSION_KEY);
}

async function rawRequest(method: string, path: string, body: unknown, token?: string, headers?: Record<string, string>) {
  const res = await fetch(`${API_BASE}/api/v1${path}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(headers || {}),
    },
    body: body === undefined || body === null ? undefined : JSON.stringify(body),
  });
  let json: any = null;
  try {
    json = await res.json();
  } catch {
    /* empty body */
  }
  if (!res.ok) {
    const err = new Error(json?.error?.message || json?.message || res.statusText) as ApiError;
    err.status = res.status;
    err.code = json?.error?.code;
    throw err;
  }
  return json?.data !== undefined ? json.data : json;
}

let refreshing: Promise<Session> | null = null;

async function rotate(session: Session): Promise<Session> {
  const res = await fetch(`${API_BASE}/api/v1/auth/refresh`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ refreshToken: session.refreshToken }),
  });
  const json = await res.json();
  if (!res.ok) throw new Error("session expired");
  const next = { token: json.data.accessToken, refreshToken: json.data.refreshToken };
  saveSession(next);
  return next;
}

export async function api<T = any>(
  method: string,
  path: string,
  body?: unknown,
  opts?: { idempotency?: boolean; headers?: Record<string, string> },
): Promise<T> {
  const session = loadSession();
  const headers = {
    ...(opts?.idempotency ? { "X-Idempotency-Key": uuidSafe() } : {}),
    ...(opts?.headers || {}),
  };
  try {
    return await rawRequest(method, path, body, session?.token, headers);
  } catch (e) {
    const err = e as ApiError;
    if (err.status === 401 && session) {
      if (!refreshing) {
        refreshing = rotate(session).finally(() => {
          refreshing = null;
        });
      }
      try {
        const next = await refreshing;
        return await rawRequest(method, path, body, next.token, headers);
      } catch {
        clearSession();
        if (typeof window !== "undefined") window.location.href = "/";
        throw new Error("Session expired — please sign in again");
      }
    }
    throw e;
  }
}

function uuidSafe() {
  return typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`;
}

export async function login(email: string, password: string) {
  const data = await rawRequest("POST", "/auth/login", { email, password });
  saveSession({ token: data.accessToken, refreshToken: data.refreshToken });
  return data.user;
}

export async function logout() {
  const session = loadSession();
  if (session) {
    fetch(`${API_BASE}/api/v1/auth/logout`, {
      method: "POST",
      headers: { Authorization: `Bearer ${session.token}`, "Content-Type": "application/json" },
    }).catch(() => undefined);
  }
  clearSession();
}

export const ROLES = {
  isExec: (r: string) => ["CEO", "CFO", "CTO", "CPO"].includes(r),
  isCEO: (r: string) => r === "CEO",
  isCFO: (r: string) => r === "CFO",
  isCTO: (r: string) => r === "CTO",
  isCPO: (r: string) => r === "CPO",
  isPM: (r: string) => r === "PM",
  isDev: (r: string) => r === "DEVELOPER",
  canManage: (r: string) => r === "CPO" || r === "CEO",
};
