import { useMemo } from 'react';
import { useSelector } from 'react-redux';
import type { RootState } from '../store';
import { decodeJwt } from '../utils/jwt';

export interface CurrentUser {
  name: string;
  email: string;
  role: string;
  departmentName: string | null;
}

/**
 * The signed-in user's display details, read from the access token. For display
 * only: the API re-checks the token and permissions on every request.
 */
export function useCurrentUser(): CurrentUser | null {
  const token = useSelector((s: RootState) => s.auth.accessToken);
  return useMemo(() => {
    const p = token ? decodeJwt(token) : null;
    if (!p) return null;
    return {
      name: p.name || p.email || '',
      email: p.email ?? '',
      role: p.role ?? '',
      departmentName: p.department?.name ?? null,
    };
  }, [token]);
}
