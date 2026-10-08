'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';
import type { Approval } from '@ti/shared';

type ApprovalKind = 'quotation' | 'order_confirmation' | 'client_update' | 'drawing';

export default function ApprovalsPage() {
  const qc = useQueryClient();

  const [showForm, setShowForm] = useState(false);
  const [formProjectId, setFormProjectId] = useState('');
  const [formKind, setFormKind] = useState<ApprovalKind>('quotation');
  const [formDocId, setFormDocId] = useState('');
  const [formMsg, setFormMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const { data: approvals, isLoading } = useQuery<Approval[]>({
    queryKey: ['approvals'],
    queryFn: () => apiClient.get('/approvals').then((r) => r.data),
  });

  const requestMutation = useMutation({
    mutationFn: (body: { projectId: string; kind: string; linkedDocumentId?: string }) =>
      apiClient.post('/approvals', body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['approvals'] });
      setShowForm(false);
      setFormProjectId('');
      setFormDocId('');
      setFormMsg({ type: 'success', text: 'Approval requested.' });
      setTimeout(() => setFormMsg(null), 3000);
    },
    onError: () => setFormMsg({ type: 'error', text: 'Failed to request approval.' }),
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

  function handleRequest(e: React.FormEvent) {
    e.preventDefault();
    if (!formProjectId) return;
    requestMutation.mutate({
      projectId: formProjectId,
      kind: formKind,
      linkedDocumentId: formDocId || undefined,
    });
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Approvals</h1>
        <button
          onClick={() => { setShowForm((v) => !v); setFormMsg(null); }}
          className="text-sm font-medium text-indigo-600 hover:text-indigo-700"
        >
          {showForm ? '✕ Cancel' : '+ New Request'}
        </button>
      </div>

      {formMsg && (
        <p className={`text-sm ${formMsg.type === 'success' ? 'text-green-600' : 'text-red-600'}`}>
          {formMsg.text}
        </p>
      )}

      {showForm && (
        <div className="bg-white rounded-lg border border-gray-200 p-5">
          <h2 className="text-sm font-semibold text-gray-700 mb-4">Request Approval</h2>
          <form onSubmit={handleRequest} className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs text-gray-500 mb-1">Project ID *</label>
              <input
                value={formProjectId}
                onChange={(e) => setFormProjectId(e.target.value)}
                placeholder="MongoDB ObjectId"
                required
                className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Kind *</label>
              <select
                value={formKind}
                onChange={(e) => setFormKind(e.target.value as ApprovalKind)}
                className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                <option value="quotation">Quotation</option>
                <option value="order_confirmation">Order Confirmation</option>
                <option value="client_update">Client Update</option>
                <option value="drawing">Drawing</option>
              </select>
            </div>
            <div className="sm:col-span-2">
              <label className="block text-xs text-gray-500 mb-1">Document ID (optional)</label>
              <input
                value={formDocId}
                onChange={(e) => setFormDocId(e.target.value)}
                placeholder="MongoDB ObjectId of linked document"
                className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
            <div className="sm:col-span-2">
              <button
                type="submit"
                disabled={requestMutation.isPending}
                className="bg-indigo-600 text-white px-4 py-2 rounded text-sm hover:bg-indigo-700 disabled:opacity-50"
              >
                {requestMutation.isPending ? 'Submitting…' : 'Submit Request'}
              </button>
            </div>
          </form>
        </div>
      )}

      <div>
        <h2 className="text-base font-semibold text-gray-700 mb-2">Pending Queue</h2>
        {isLoading && <p className="text-sm text-gray-500">Loading…</p>}
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
          {!isLoading && approvals?.length === 0 && (
            <div className="px-4 py-8 text-center text-sm text-gray-400">
              No pending approvals.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
