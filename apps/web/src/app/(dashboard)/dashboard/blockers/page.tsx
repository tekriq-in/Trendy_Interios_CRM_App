'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';
import type { Blocker } from '@ti/shared';

type BlockerPopulated = Blocker & {
  project?: { _id: string; title: string };
  raisedBy?: { name: string };
};

interface RaiseForm {
  title: string;
  description: string;
  type: 'internal' | 'client_side';
  projectId: string;
}

const EMPTY_FORM: RaiseForm = { title: '', description: '', type: 'internal', projectId: '' };

export default function BlockersPage() {
  const qc = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<RaiseForm>(EMPTY_FORM);
  const [filter, setFilter] = useState<'all' | 'open' | 'sla_triggered' | 'resolved'>('all');

  const { data: blockers, isLoading } = useQuery<BlockerPopulated[]>({
    queryKey: ['blockers', filter],
    queryFn: () =>
      apiClient
        .get(filter === 'all' ? '/blockers' : `/blockers?status=${filter}`)
        .then((r) => r.data),
  });

  const raise = useMutation({
    mutationFn: (data: RaiseForm) =>
      apiClient.post('/blockers', {
        title: data.title,
        description: data.description,
        type: data.type,
        project: data.projectId,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['blockers'] });
      setShowForm(false);
      setForm(EMPTY_FORM);
    },
  });

  const triggerSla = useMutation({
    mutationFn: (id: string) => apiClient.patch(`/blockers/${id}/trigger-sla`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['blockers'] }),
  });

  const resolve = useMutation({
    mutationFn: (id: string) => apiClient.patch(`/blockers/${id}/resolve`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['blockers'] }),
  });

  const statusBadge = (status: string) => {
    const map: Record<string, string> = {
      open: 'bg-yellow-100 text-yellow-800',
      sla_triggered: 'bg-red-100 text-red-800',
      resolved: 'bg-green-100 text-green-800',
    };
    return map[status] ?? 'bg-gray-100 text-gray-700';
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Blockers</h1>
        <button
          onClick={() => setShowForm((v) => !v)}
          className="text-sm bg-blue-600 text-white px-3 py-1.5 rounded hover:bg-blue-700"
        >
          {showForm ? 'Cancel' : 'Raise Blocker'}
        </button>
      </div>

      {showForm && (
        <div className="bg-white border border-gray-200 rounded-lg p-4 space-y-3">
          <h2 className="font-semibold text-gray-800 text-sm">New Blocker</h2>
          <input
            className="w-full border border-gray-300 rounded px-3 py-1.5 text-sm"
            placeholder="Title"
            value={form.title}
            onChange={(e) => setForm({ ...form, title: e.target.value })}
          />
          <textarea
            className="w-full border border-gray-300 rounded px-3 py-1.5 text-sm"
            placeholder="Description"
            rows={2}
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
          />
          <div className="flex gap-3">
            <select
              className="border border-gray-300 rounded px-3 py-1.5 text-sm"
              value={form.type}
              onChange={(e) => setForm({ ...form, type: e.target.value as RaiseForm['type'] })}
            >
              <option value="internal">Internal</option>
              <option value="client_side">Client-side</option>
            </select>
            <input
              className="flex-1 border border-gray-300 rounded px-3 py-1.5 text-sm"
              placeholder="Project ID"
              value={form.projectId}
              onChange={(e) => setForm({ ...form, projectId: e.target.value })}
            />
          </div>
          <button
            onClick={() => raise.mutate(form)}
            disabled={raise.isPending || !form.title || !form.projectId}
            className="text-sm bg-blue-600 text-white px-3 py-1.5 rounded hover:bg-blue-700 disabled:opacity-50"
          >
            {raise.isPending ? 'Saving…' : 'Submit'}
          </button>
          {raise.isError && (
            <p className="text-xs text-red-600">Failed to raise blocker.</p>
          )}
        </div>
      )}

      <div className="flex gap-2">
        {(['all', 'open', 'sla_triggered', 'resolved'] as const).map((s) => (
          <button
            key={s}
            onClick={() => setFilter(s)}
            className={`text-xs px-3 py-1 rounded-full border ${
              filter === s
                ? 'bg-blue-600 text-white border-blue-600'
                : 'border-gray-300 text-gray-600 hover:bg-gray-100'
            }`}
          >
            {s === 'all' ? 'All' : s === 'sla_triggered' ? 'SLA Triggered' : s.charAt(0).toUpperCase() + s.slice(1)}
          </button>
        ))}
      </div>

      {isLoading ? (
        <p className="text-sm text-gray-500">Loading…</p>
      ) : (
        <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
          <table className="min-w-full divide-y divide-gray-200 text-sm">
            <thead className="bg-gray-50">
              <tr>
                {['Title', 'Type', 'Status', 'Project', 'Raised By', 'SLA At', 'Actions'].map((h) => (
                  <th key={h} className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {blockers?.map((b) => (
                <tr key={b._id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium text-gray-800">{b.title}</td>
                  <td className="px-4 py-3 text-gray-600">
                    {b.type === 'client_side' ? 'Client-side' : 'Internal'}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${statusBadge(b.status)}`}>
                      {b.status === 'sla_triggered' ? 'SLA Triggered' : b.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-600">{b.project?.title ?? '—'}</td>
                  <td className="px-4 py-3 text-gray-600">{b.raisedBy?.name ?? '—'}</td>
                  <td className="px-4 py-3 text-gray-500 text-xs">
                    {b.slaTriggeredAt ? new Date(b.slaTriggeredAt).toLocaleDateString() : '—'}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex gap-1.5">
                      {b.status === 'open' && (
                        <button
                          onClick={() => triggerSla.mutate(b._id)}
                          disabled={triggerSla.isPending}
                          className="text-xs bg-orange-600 text-white px-2 py-1 rounded hover:bg-orange-700 disabled:opacity-50"
                        >
                          Trigger SLA
                        </button>
                      )}
                      {(b.status === 'open' || b.status === 'sla_triggered') && (
                        <button
                          onClick={() => resolve.mutate(b._id)}
                          disabled={resolve.isPending}
                          className="text-xs bg-green-600 text-white px-2 py-1 rounded hover:bg-green-700 disabled:opacity-50"
                        >
                          Resolve
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
              {blockers?.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-sm text-gray-400">
                    No blockers found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
