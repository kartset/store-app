/**
 * Auth token inspection, validation, and session helper utilities.
 */

export interface AuthSession {
  accessToken: string | null;
  refreshToken: string | null;
  user: any | null;
  currentStore: any | null;
  isAuthenticated: boolean;
  isOrgAdmin: boolean;
}

/**
 * Checks if a JWT token is expired by decoding the 'exp' claim.
 * Includes a 10-second safety buffer.
 */
export function isTokenExpired(token: string | null): boolean {
  if (!token || typeof token !== 'string') return true;

  try {
    const parts = token.split('.');
    if (parts.length !== 3) return true;

    // Use atob to decode the base64url payload
    const base64Url = parts[1];
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    const jsonPayload = decodeURIComponent(
      atob(base64)
        .split('')
        .map((c) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
        .join('')
    );
    const decoded = JSON.parse(jsonPayload);

    if (!decoded.exp) return false;

    // Expired if current time in ms is past (exp * 1000 - 10000ms buffer)
    return Date.now() >= decoded.exp * 1000 - 10000;
  } catch {
    return true;
  }
}

/**
 * Retrieves the current session info from localStorage and computes authorization flags.
 */
export function getAuthSession(): AuthSession {
  try {
    const accessToken = localStorage.getItem('access_token');
    const refreshToken = localStorage.getItem('refresh_token');
    const userStr = localStorage.getItem('user');
    const storeStr = localStorage.getItem('current_store');

    const user = userStr ? JSON.parse(userStr) : null;
    const currentStore = storeStr ? JSON.parse(storeStr) : null;

    // Authenticated if user object exists AND at least one valid token exists
    // (if access token is expired, refresh token allows silent refresh via Axios interceptor)
    const hasValidToken = Boolean(
      (accessToken && !isTokenExpired(accessToken)) ||
      (refreshToken && !isTokenExpired(refreshToken))
    );

    const isAuthenticated = Boolean(user && hasValidToken);

    const isOrgAdmin = Boolean(
      user &&
      (user.is_org_admin ||
        user.role === 'ORG_ADMIN' ||
        user.role === 'SUPER_ADMIN' ||
        currentStore?.role === 'ORG_ADMIN' ||
        user.organizations?.some((org: any) => org.role === 'ORG_ADMIN'))
    );

    return {
      accessToken,
      refreshToken,
      user,
      currentStore,
      isAuthenticated,
      isOrgAdmin,
    };
  } catch {
    return {
      accessToken: null,
      refreshToken: null,
      user: null,
      currentStore: null,
      isAuthenticated: false,
      isOrgAdmin: false,
    };
  }
}

/**
 * Clears all auth session data from localStorage.
 */
export function clearAuthSession(): void {
  try {
    localStorage.removeItem('access_token');
    localStorage.removeItem('refresh_token');
    localStorage.removeItem('user');
    localStorage.removeItem('current_store');
  } catch {
    // ignore
  }
}
