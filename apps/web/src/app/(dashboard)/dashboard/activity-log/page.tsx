'use client';

import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';
import type { ActivityLog } from '@ti/shared';

export default function ActivityLogPage() {
  const { data, isLoading } = useQuery<{ data: ActivityLog[]; total: number }>({
    queryKey: ['activity-log'],
    queryFn: () => apiClient.get('/activity-log?limit=50').then((r) => r.data),
  });

  if (isLoading) return <p className="text-sm text-gray-500">Loading…</p>;

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold text-gray-900">Activity Log</h1>
      <p className="text-sm text-gray-500">{data?.total ?? 0} total entries</p>

      <div className="bg-white rounded-lg border border-gray-200 divide-y">
        {data?.data.map((entry) => (
          <div key={entry._id} className="px-4 py-3">
            <div className="flex items-center justify-between">
              <p className="text-sm font-mono text-blue-700 font-medium">{entry.action}</p>
              <p className="text-xs text-gray-400">
                {new Date(entry.createdAt).toLocaleString('en-IN', {
                  timeZone: 'Asia/Kolkata',
                })}
              </p>
            </div>
            <p className="text-xs text-gray-500 mt-0.5">
              {typeof entry.actor === 'object' && entry.actor
                ? (entry.actor as { name: string }).name
                : 'System'}{' '}
              · {entry.entity} · {String(entry.entityId)}
            </p>
          </div>
        ))}
        {data?.data.length === 0 && (
          <div className="px-4 py-8 text-center text-sm text-gray-400">No activity yet.</div>
        )}
      </div>
    </div>
  );
}
