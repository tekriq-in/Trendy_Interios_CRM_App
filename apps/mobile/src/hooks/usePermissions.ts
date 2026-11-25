import { useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { api } from '../services/api';
import { setPermissions } from '../store/slices/session.slice';
import type { RootState } from '../store';

/**
 * Loads the signed-in user's permission slugs. Call it ONCE, in the signed-in
 * layout, so screens do not each re-fetch them. The result is cached in the
 * session slice, so buttons still show when the app starts offline.
 */
export function useLoadPermissions() {
  const dispatch = useDispatch();
  const token = useSelector((s: RootState) => s.auth.accessToken);

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
}

/**
 * Reads the cached permissions and exposes `can(slug)`. Used only to decide which
 * buttons to SHOW: the API still enforces every permission, so hiding a button is
 * a convenience, not security.
 */
export function usePermissions() {
  const permissions = useSelector((s: RootState) => s.session.permissions);
  return {
    permissions,
    can: (slug: string) => permissions.includes(slug),
  };
}
