export const API_BASE = '/api'

function getToken() {
  return localStorage.getItem('token') || ''
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
  const headers: HeadersInit = {
    'content-type': 'application/json',
    ...(token ? { authorization: `Bearer ${token}` } : {}),
    ...(init.headers ?? {}),
  }

  const resolvedUrl = resolveUrl(path);
  console.log('[API] Requesting:', init.method || 'GET', resolvedUrl);

  try {
    const res = await fetch(resolvedUrl, {
      credentials: 'include',
      ...init,
      headers,
    })

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
    throw new NetworkError('Cannot reach backend API', err)
  }
}

export function get<T>(path: string) {
  return request<T>(path, { method: 'GET' })
}

export function post<T>(path: string, body: unknown) {
  return request<T>(path, { method: 'POST', body: JSON.stringify(body) })
}

export function patch<T>(path: string, body: unknown) {
  return request<T>(path, { method: 'PATCH', body: JSON.stringify(body) })
}

export function del<T>(path: string) {
  return request<T>(path, { method: 'DELETE' })
}

export function setToken(token: string) {
  localStorage.setItem('token', token)
}
