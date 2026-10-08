'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';
import type { Approval } from '@ti/shared';

export default function ApprovalsPage() {
  const qc = useQueryClient();

  const { data: approvals, isLoading } = useQuery<Approval[]>({
    queryKey: ['approvals'],
    queryFn: () => apiClient.get('/approvals').then((r) => r.data),
  });

  const approveMutation = useMutation({
    mutationFn: (id: string) => apiClient.patch(`/approvals/${id}/approve`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['approvals'] }),
  });

  const rejectMutation = useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) =>
      apiClient.patch(`/approvals/${id}/reject`, { reason }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['approvals'] }),
  });

  if (isLoading) return <p className="text-sm text-gray-500">Loading…</p>;

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold text-gray-900">Pending Approvals</h1>

      <div className="bg-white rounded-lg border border-gray-200 divide-y">
        {approvals?.map((a) => (
          <div key={a._id} className="px-4 py-4 flex items-start justify-between gap-4">
            <div>
              <p className="text-sm font-medium text-gray-800">
                {typeof a.project === 'object' && a.project
                  ? (a.project as { title: string }).title
                  : 'Project'}
              </p>
              <p className="text-xs text-gray-500 mt-0.5">
                {a.kind.replace(/_/g, ' ')} · requested by{' '}
                {typeof a.requestedBy === 'object' && a.requestedBy
                  ? (a.requestedBy as { name: string }).name
                  : 'User'}
              </p>
            </div>
            <div className="flex gap-2 shrink-0">
              <button
                onClick={() => approveMutation.mutate(a._id)}
                disabled={approveMutation.isPending}
                className="text-xs bg-green-600 text-white px-3 py-1.5 rounded hover:bg-green-700 disabled:opacity-50"
              >
                Approve
              </button>
              <button
                onClick={() => {
                  const reason = prompt('Rejection reason:');
                  if (reason) rejectMutation.mutate({ id: a._id, reason });
                }}
                disabled={rejectMutation.isPending}
                className="text-xs bg-red-600 text-white px-3 py-1.5 rounded hover:bg-red-700 disabled:opacity-50"
              >
                Reject
              </button>
            </div>
          </div>
        ))}
        {approvals?.length === 0 && (
          <div className="px-4 py-8 text-center text-sm text-gray-400">
            No pending approvals.
          </div>
        )}
      </div>
    </div>
  );
}
