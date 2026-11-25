export interface JwtProfile {
  sub: string;
  email?: string;
  name?: string;
  role?: string;
  department?: { id: string; name: string } | null;
  mustChangePassword?: boolean;
}

/**
 * Reads the (unverified) claims from an access token so the UI can show the
 * user's name and role. This is for display only: the API re-checks the token
 * and permissions on every request, so nothing here grants access.
 */
export function decodeJwt(token: string): JwtProfile | null {
  try {
    const part = token.split('.')[1];
    if (!part) return null;
    const padded = part.replace(/-/g, '+').replace(/_/g, '/');
    const json = decodeURIComponent(
      atob(padded)
        .split('')
        .map((c) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
        .join(''),
    );
    const payload = JSON.parse(json) as JwtProfile;
    return typeof payload.sub === 'string' ? payload : null;
  } catch {
    return null;
  }
}
