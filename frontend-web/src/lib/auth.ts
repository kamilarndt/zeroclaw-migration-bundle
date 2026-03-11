// ---------------------------------------------------------------------------
// Authentication Token Management with Enhanced Debugging
// ---------------------------------------------------------------------------

const TOKEN_KEY = 'zeroclaw_token';

/**
 * Retrieve the stored authentication token from multiple storage types.
 */
export function getToken(): string | null {
  console.log('[Auth] getToken() called');

  // Try localStorage first
  try {
    const token = localStorage.getItem(TOKEN_KEY);
    if (token) {
      console.log('[Auth] ✓ Token found in localStorage:', token.substring(0, 10) + '...');
      return token;
    } else {
      console.log('[Auth] ✗ No token in localStorage');
    }
  } catch (e) {
    console.warn('[Auth] ✗ localStorage.getItem failed:', e);
  }

  // Fallback to sessionStorage
  try {
    const token = sessionStorage.getItem(TOKEN_KEY);
    if (token) {
      console.log('[Auth] ✓ Token found in sessionStorage (migrating...)');
      // Try to migrate to localStorage
      try {
        localStorage.setItem(TOKEN_KEY, token);
        console.log('[Auth] ✓ Migrated to localStorage');
      } catch (e) {
        console.warn('[Auth] ✗ Migration to localStorage failed:', e);
      }
      return token;
    } else {
      console.log('[Auth] ✗ No token in sessionStorage');
    }
  } catch (e) {
    console.warn('[Auth] ✗ sessionStorage.getItem failed:', e);
  }

  return null;
}

/**
 * Store an authentication token in multiple storage types for persistence.
 */
export function setToken(token: string): void {
  console.log('[Auth] setToken() called with:', token.substring(0, 10) + '...');
  let storageSuccess = false;

  // Store in localStorage
  try {
    localStorage.setItem(TOKEN_KEY, token);
    console.log('[Auth] ✓ Token stored in localStorage');
    storageSuccess = true;

    // Verify it was stored
    const verify = localStorage.getItem(TOKEN_KEY);
    if (verify === token) {
      console.log('[Auth] ✓ Verification successful');
    } else {
      console.error('[Auth] ✗ Verification FAILED! Stored:', verify, 'Expected:', token);
    }
  } catch (e) {
    console.error('[Auth] ✗ Failed to store in localStorage:', e);
  }

  // Also store in sessionStorage as backup
  try {
    sessionStorage.setItem(TOKEN_KEY, token);
    console.log('[Auth] ✓ Token stored in sessionStorage (backup)');
    storageSuccess = true;
  } catch (e) {
    console.error('[Auth] ✗ Failed to store in sessionStorage:', e);
  }

  if (!storageSuccess) {
    console.error('[Auth] ✗✗ CRITICAL: Could not store token in ANY storage!');
  }

  // Log storage info
  try {
    console.log('[Auth] Storage info:', {
      localStorageLength: localStorage.length,
      sessionStorageLength: sessionStorage.length,
      localStorageKeys: Object.keys(localStorage),
      sessionStorageKeys: Object.keys(sessionStorage),
    });
  } catch (e) {
    console.error('[Auth] Could not log storage info:', e);
  }
}

/**
 * Remove the stored authentication token from all storage types.
 */
export function clearToken(): void {
  console.log('[Auth] clearToken() called');

  try {
    localStorage.removeItem(TOKEN_KEY);
    console.log('[Auth] ✓ Token cleared from localStorage');
  } catch (e) {
    console.warn('[Auth] ✗ Failed to clear from localStorage:', e);
  }

  try {
    sessionStorage.removeItem(TOKEN_KEY);
    console.log('[Auth] ✓ Token cleared from sessionStorage');
  } catch (e) {
    console.warn('[Auth] ✗ Failed to clear from sessionStorage:', e);
  }
}

/**
 * Returns true if a token is currently stored in any storage.
 */
export function isAuthenticated(): boolean {
  const token = getToken();
  const isAuth = token !== null && token.length > 0;
  console.log('[Auth] isAuthenticated():', isAuth, 'tokenLength:', token?.length || 0);
  return isAuth;
}
