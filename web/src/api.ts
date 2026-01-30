export const API_BASE = '/api'

/**
 * CANONICAL API CLIENT
 * 
 * This is the single source of truth for all API requests.
 * 
 * IMPORTANT: Do NOT import from '../api/client' for new code.
 * All API calls should use get/post/patch/del from this module.
 * 
 * Dev identity: Set localStorage.setItem('DFOS_FORCE_DEV_IDENTITY','1') to force dev headers.
 */

// Dev identity gating: opt-in via localStorage flag
const FORCE_DEV_IDENTITY = import.meta.env.DEV && (localStorage.getItem("DFOS_FORCE_DEV_IDENTITY") === "1");
let didWarnDevToken = false;

function getToken() {
  return localStorage.getItem('token') || ''
}

function getDevHeaders(): HeadersInit {
  return {
    "x-dev-org-id": localStorage.getItem("DFOS_DEV_ORG_ID") || "org_dev",
    "x-dev-user-id": localStorage.getItem("DFOS_DEV_USER_ID") || "user_dev",
  };
}

export class ApiError extends Error {
  status: number
  body: unknown

  constructor(status: number, message: string, body?: unknown) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.body = body
  }
}

export class NetworkError extends Error {
  cause?: unknown

  constructor(message: string, cause?: unknown) {
    super(message)
    this.name = 'NetworkError'
    this.cause = cause
  }
}

function resolveUrl(path: string) {
  // If path is already a full URL, return as-is
  if (/^https?:\/\//i.test(path)) {
    return path
  }
  // If path already starts with API_BASE, return as-is to avoid double-prefixing
  if (path.startsWith(API_BASE)) {
    return path
  }
  // Normalize path to start with / and prepend API_BASE
  const normalizedPath = path.startsWith('/') ? path : `/${path}`
  return `${API_BASE}${normalizedPath}`
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const token = getToken()
  
  // Dev-only warning: token present but dev identity not forced
  if (import.meta.env.DEV && !FORCE_DEV_IDENTITY && token && !didWarnDevToken) {
    didWarnDevToken = true;
    console.warn("[API] DEV token present; KPIs/leads may diverge unless you either:");
    console.warn("  (a) Set: localStorage.setItem('DFOS_FORCE_DEV_IDENTITY','1') and reload, OR");
    console.warn("  (b) Clear token: localStorage.removeItem('token')");
  }
  
  // Compose headers: base → dev (if forced) → auth (if not forced) → overrides
  const base: HeadersInit = { "content-type": "application/json" };
  const dev = FORCE_DEV_IDENTITY ? getDevHeaders() : {};
  const auth = (!FORCE_DEV_IDENTITY && token) ? { authorization: `Bearer ${token}` } : {};
  const headers: HeadersInit = { ...base, ...dev, ...auth, ...(init.headers ?? {}) };

  const resolvedUrl = resolveUrl(path);
  console.log('[API] Requesting:', init.method || 'GET', resolvedUrl);

  try {
    const res = await fetch(resolvedUrl, {
      credentials: 'include',
      ...init,
      headers,
    })

    // Detect proxy failures: text/plain with 500 on /api/* routes
    const contentType = res.headers.get('content-type') || '';
    const isProxyFailure = 
      resolvedUrl.startsWith('/api/') &&
      res.status === 500 &&
      contentType.includes('text/plain');

    const text = await res.text()
    let data: any = null
    if (text) {
      try {
        data = JSON.parse(text)
      } catch {
        data = { raw: text }
      }
    }

    console.log('[API] Response:', res.status, res.ok, data);

    if (isProxyFailure) {
      // Proxy failure detected - backend unreachable
      throw new NetworkError(
        'Backend unreachable. Start server: cd server && npm run dev (expects 127.0.0.1:3010)',
        { status: res.status, raw: text }
      )
    }

    if (!res.ok) {
      const message =
        data?.message ||
        data?.error ||
        res.statusText ||
        `HTTP ${res.status}`
      throw new ApiError(res.status, String(message), data)
    }

    return (data ?? {}) as T
  } catch (err) {
    if (err instanceof ApiError) {
      throw err
    }
    // Detect network/proxy errors (ECONNREFUSED, fetch failures)
    if (
      err instanceof TypeError ||
      (err instanceof NetworkError && err.cause) ||
      (err as any)?.message?.includes('Failed to fetch') ||
      (err as any)?.message?.includes('ECONNREFUSED')
    ) {
      throw new NetworkError(
        'Backend unreachable. Start server: cd server && npm run dev (expects 127.0.0.1:3010)',
        err
      )
    }
    throw new NetworkError('Cannot reach backend API', err)
  }
}

export function get<T>(path: string, headers?: HeadersInit) {
  return request<T>(path, { method: 'GET', headers })
}

export function post<T>(path: string, body: unknown, headers?: HeadersInit) {
  return request<T>(path, { method: 'POST', body: JSON.stringify(body), headers })
}

export function patch<T>(path: string, body: unknown, headers?: HeadersInit) {
  return request<T>(path, { method: 'PATCH', body: JSON.stringify(body), headers })
}

export function del<T>(path: string, headers?: HeadersInit) {
  return request<T>(path, { method: 'DELETE', headers })
}

export function setToken(token: string) {
  localStorage.setItem('token', token)
}
