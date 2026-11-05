'use client';

import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';

interface PermissionsResponse {
  permissions: string[];
}

export function usePermissions() {
  const { data, isLoading, isError } = useQuery<PermissionsResponse>({
    queryKey: ['auth', 'permissions'],
    queryFn: () => apiClient.get('/auth/permissions').then((response) => response.data),
    staleTime: 60_000,
  });

  return {
    hasPermission: (permission: string) => data?.permissions.includes(permission) ?? false,
    isLoading,
    isError,
  };
}
