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
 * Build URL with query params
 */
function buildUrl(path: string, params?: Record<string, string | number | undefined>): string {
  // If path already starts with API_BASE, use as-is to avoid double-prefixing
  let fullPath: string;
  if (path.startsWith(API_BASE_URL)) {
    fullPath = path;
  } else {
    // Normalize path to start with / and prepend API_BASE
    const normalizedPath = path.startsWith('/') ? path : `/${path}`;
    fullPath = `${API_BASE_URL}${normalizedPath}`;
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
      err?.name === 'TypeError'
    ) {
      console.error(
        '[API CONNECTION ERROR]',
        'Could not reach backend at http://localhost:3010',
        'Request:',
        url,
        '→ Is the DEV server running?'
      );
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




