import { useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { api } from '../services/api';
import { setPermissions } from '../store/slices/auth.slice';
import type { RootState } from '../store';

/**
 * Loads the signed-in user's permission slugs once per session and exposes
 * `can(slug)`. Used only to decide which buttons to SHOW: the API still
 * enforces every permission, so hiding a button is a convenience, not security.
 */
export function usePermissions() {
  const dispatch = useDispatch();
  const token = useSelector((s: RootState) => s.auth.accessToken);
  const permissions = useSelector((s: RootState) => s.auth.permissions);

  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    api
      .get<{ permissions: string[] }>('/auth/permissions')
      .then((res) => {
        if (!cancelled) dispatch(setPermissions(res.data.permissions ?? []));
      })
      .catch(() => {
        // Offline: keep whatever was cached from the last session.
      });
    return () => {
      cancelled = true;
    };
  }, [token, dispatch]);

  return {
    permissions,
    can: (slug: string) => permissions.includes(slug),
  };
}
