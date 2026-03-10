// ---------------------------------------------------------------------------
// API Client for ZeroClaw
// ---------------------------------------------------------------------------

/**
 * Pair with the ZeroClaw agent using a 6-digit code.
 * Returns a bearer token that should be stored and used for subsequent requests.
 */
export async function pair(code: string): Promise<{ token: string }> {
  const response = await fetch('http://127.0.0.1:42617/api/v1/pair', {
    method: 'POST',
    headers: {
      'X-Pairing-Code': code.trim(),
    },
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(text || `Pairing failed: ${response.status}`);
  }

  return response.json() as Promise<{ token: string }>;
}

/**
 * Public health check (no authentication required).
 * Returns whether pairing is required and whether the agent is already paired.
 */
export async function getPublicHealth(): Promise<{ require_pairing: boolean; paired: boolean }> {
  const response = await fetch('http://127.0.0.1:42617/health');

  if (!response.ok) {
    throw new Error(`Health check failed: ${response.status}`);
  }

  return response.json() as Promise<{ require_pairing: boolean; paired: boolean }>;
}

/**
 * Authenticated API fetch wrapper.
 * Includes the bearer token from localStorage if available.
 */
export async function apiFetch<T>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const token = localStorage.getItem('zeroclaw_token');

  // Prepend base URL if path is relative
  const fetchUrl = path.startsWith('/') ? `http://127.0.0.1:42617/api/v1${path}` : path;
  const response = await fetch(fetchUrl, {
    ...options,
    headers: {
      ...options.headers,
      ...(token && { Authorization: `Bearer ${token}` }),
    },
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(text || `API error: ${response.status}`);
  }

  return response.json() as Promise<T>;
}