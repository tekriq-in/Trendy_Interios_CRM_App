'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';
import type { Blocker } from '@ti/shared';

type BlockerPopulated = Blocker & { project?: { title: string }; raisedBy?: { name: string } };

export default function BlockersPage() {
  const qc = useQueryClient();

  const { data: blockers, isLoading } = useQuery<BlockerPopulated[]>({
    queryKey: ['blockers'],
    queryFn: () => apiClient.get('/blockers?status=open').then((r) => r.data),
  });

  const triggerSla = useMutation({
    mutationFn: (id: string) => apiClient.patch(`/blockers/${id}/trigger-sla`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['blockers'] }),
  });

  const resolve = useMutation({
    mutationFn: (id: string) => apiClient.patch(`/blockers/${id}/resolve`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['blockers'] }),
  });

  if (isLoading) return <p className="text-sm text-gray-500">Loading…</p>;

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold text-gray-900">Open Blockers</h1>

      <div className="bg-white rounded-lg border border-gray-200 divide-y">
        {blockers?.map((b) => (
          <div key={b._id} className="px-4 py-4">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-sm font-medium text-gray-800">{b.title}</p>
                <p className="text-xs text-gray-500 mt-0.5">
                  {b.type === 'client_side' ? '🔴 Client-side' : '🟡 Internal'} ·{' '}
                  {b.project?.title ?? 'Project'} · raised by {b.raisedBy?.name ?? 'User'}
                </p>
                <p className="text-xs text-gray-600 mt-1">{b.description}</p>
              </div>
              <div className="flex flex-col gap-2 shrink-0">
                {b.status === 'open' && (
                  <button
                    onClick={() => triggerSla.mutate(b._id)}
                    disabled={triggerSla.isPending}
                    className="text-xs bg-orange-600 text-white px-2 py-1 rounded hover:bg-orange-700 disabled:opacity-50"
                  >
                    Trigger SLA
                  </button>
                )}
                <button
                  onClick={() => resolve.mutate(b._id)}
                  disabled={resolve.isPending}
                  className="text-xs bg-green-600 text-white px-2 py-1 rounded hover:bg-green-700 disabled:opacity-50"
                >
                  Resolve
                </button>
              </div>
            </div>
          </div>
        ))}
        {blockers?.length === 0 && (
          <div className="px-4 py-8 text-center text-sm text-gray-400">No open blockers.</div>
        )}
      </div>
    </div>
  );
}
