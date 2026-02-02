/**
 * API Client Configuration
 * Centralized HTTP client for all API calls
 */

const API_BASE_URL = "/api";

interface RequestOptions extends RequestInit {
  params?: Record<string, string | number | undefined>;
}

/**
 * Get auth headers (for dev mode)
 */
function getAuthHeaders(): Record<string, string> {
  // In production, this would use a real auth token
  return {
    "x-dev-user-id": "user_dev",
    "x-dev-user-email": "dev@example.com",
    "x-dev-org-id": "org_dev",
    "Content-Type": "application/json",
  };
}

/**
 * Normalize path before prepending API_BASE_URL so /api/kpis does not become /api/api/kpis.
 */
function normalizePath(path: string): string {
  const withSlash = path.startsWith('/') ? path : `/${path}`;
  if (API_BASE_URL.endsWith('/api') && withSlash.startsWith('/api/')) return withSlash.slice(4);
  if (API_BASE_URL.endsWith('/api') && withSlash === '/api') return '/';
  return withSlash;
}

/**
 * Build URL with query params
 */
function buildUrl(path: string, params?: Record<string, string | number | undefined>): string {
  const normalized = normalizePath(path);
  // If path already starts with API_BASE, use as-is to avoid double-prefixing
  let fullPath: string;
  if (normalized.startsWith(API_BASE_URL)) {
    fullPath = normalized;
  } else {
    fullPath = `${API_BASE_URL}${normalized}`;
  }
  
  // Add query params if provided
  if (params && Object.keys(params).length > 0) {
    const searchParams = new URLSearchParams();
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined) {
        searchParams.set(key, String(value));
      }
    });
    fullPath += `?${searchParams.toString()}`;
  }
  
  return fullPath;
}

/**
 * Generic API fetch wrapper
 */
export async function apiFetch<T>(
  path: string,
  options: RequestOptions = {}
): Promise<T> {
  const { params, ...fetchOptions } = options;
  
  const url = buildUrl(path, params);
  
  try {
    const response = await fetch(url, {
      ...fetchOptions,
      headers: {
        ...getAuthHeaders(),
        ...fetchOptions.headers,
      },
    });

    // Detect proxy failures: text/plain with 500 on /api/* routes
    const contentType = response.headers.get('content-type') || '';
    const isProxyFailure = 
      url.startsWith('/api/') &&
      response.status === 500 &&
      contentType.includes('text/plain');

    if (isProxyFailure) {
      const text = await response.text().catch(() => '');
      throw new Error('Backend unreachable. Start server: cd server && npm run dev (expects 127.0.0.1:3010)');
    }

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: "Unknown error" }));
      throw new Error(error.error || `API Error: ${response.status}`);
    }

    return response.json();
  } catch (err: any) {
    // Detect ECONNREFUSED or network proxy failures
    if (
      err?.message?.includes('Failed to fetch') ||
      err?.message?.includes('ECONNREFUSED') ||
      err?.message?.includes('NetworkError') ||
      err?.code === 'ECONNREFUSED' ||
      err?.name === 'TypeError' ||
      err?.message?.includes('Backend unreachable')
    ) {
      console.error(
        '[API CONNECTION ERROR]',
        'Could not reach backend at http://127.0.0.1:3010',
        'Request:',
        url,
        '→ Is the DEV server running?'
      );
      // Re-throw with clear message if not already set
      if (!err.message?.includes('Backend unreachable')) {
        throw new Error('Backend unreachable. Start server: cd server && npm run dev (expects 127.0.0.1:3010)');
      }
    }
    throw err;
  }
}

/**
 * API Methods
 */
export const api = {
  get: <T>(path: string, params?: Record<string, string | number | undefined>) =>
    apiFetch<T>(path, { method: "GET", params }),

  post: <T>(path: string, body?: unknown) =>
    apiFetch<T>(path, { method: "POST", body: JSON.stringify(body) }),

  put: <T>(path: string, body?: unknown) =>
    apiFetch<T>(path, { method: "PUT", body: JSON.stringify(body) }),

  patch: <T>(path: string, body?: unknown) =>
    apiFetch<T>(path, { method: "PATCH", body: JSON.stringify(body) }),

  delete: <T>(path: string) =>
    apiFetch<T>(path, { method: "DELETE" }),
};




