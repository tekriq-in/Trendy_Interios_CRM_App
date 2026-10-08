'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, X } from 'lucide-react';
import { apiClient } from '@/lib/api-client';
import type { Blocker } from '@ti/shared';
import { Table, Th, Td, Tr } from '@/components/ui/Table';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { PageHeader } from '@/components/ui/PageHeader';

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

type Filter = 'all' | 'open' | 'sla_triggered' | 'resolved';

const FILTERS: { value: Filter; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'open', label: 'Open' },
  { value: 'sla_triggered', label: 'SLA Triggered' },
  { value: 'resolved', label: 'Resolved' },
];

const inputCls = 'w-full border border-slate-300 rounded-lg px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-shadow';

export default function BlockersPage() {
  const qc = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<RaiseForm>(EMPTY_FORM);
  const [filter, setFilter] = useState<Filter>('all');

  const { data: blockers, isLoading } = useQuery<BlockerPopulated[]>({
    queryKey: ['blockers', filter],
    queryFn: () => apiClient.get(filter === 'all' ? '/blockers' : `/blockers?status=${filter}`).then(r => r.data),
  });

  const raise = useMutation({
    mutationFn: (data: RaiseForm) => apiClient.post('/blockers', { title: data.title, description: data.description, type: data.type, project: data.projectId }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['blockers'] }); setShowForm(false); setForm(EMPTY_FORM); },
  });

  const triggerSla = useMutation({
    mutationFn: (id: string) => apiClient.patch(`/blockers/${id}/trigger-sla`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['blockers'] }),
  });

  const resolve = useMutation({
    mutationFn: (id: string) => apiClient.patch(`/blockers/${id}/resolve`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['blockers'] }),
  });

  function statusVariant(status: string): 'yellow' | 'red' | 'green' | 'gray' {
    if (status === 'open') return 'yellow';
    if (status === 'sla_triggered') return 'red';
    if (status === 'resolved') return 'green';
    return 'gray';
  }

  return (
    <div className="space-y-5">
      <PageHeader
        title="Blockers"
        description="Track and resolve project blockers"
        action={
          <Button variant={showForm ? 'secondary' : 'primary'} onClick={() => setShowForm(v => !v)}>
            {showForm ? <><X className="w-4 h-4" /> Cancel</> : <><Plus className="w-4 h-4" /> Raise Blocker</>}
          </Button>
        }
      />

      {showForm && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
          <h2 className="text-sm font-semibold text-slate-800 mb-4">New Blocker</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="sm:col-span-2">
              <label className="block text-xs font-medium text-slate-600 mb-1">Title *</label>
              <input className={inputCls} placeholder="Brief title of the blocker" value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} />
            </div>
            <div className="sm:col-span-2">
              <label className="block text-xs font-medium text-slate-600 mb-1">Description</label>
              <textarea className={inputCls} placeholder="What is blocking progress?" rows={2} value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Type</label>
              <select className={inputCls} value={form.type} onChange={e => setForm({ ...form, type: e.target.value as RaiseForm['type'] })}>
                <option value="internal">Internal</option>
                <option value="client_side">Client-side</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Project ID *</label>
              <input className={inputCls} placeholder="MongoDB ObjectId" value={form.projectId} onChange={e => setForm({ ...form, projectId: e.target.value })} />
            </div>
            <div className="sm:col-span-2">
              <Button onClick={() => raise.mutate(form)} disabled={raise.isPending || !form.title || !form.projectId}>
                {raise.isPending ? 'Saving…' : 'Submit Blocker'}
              </Button>
              {raise.isError && <p className="text-xs text-red-600 mt-2">Failed to raise blocker. Please try again.</p>}
            </div>
          </div>
        </div>
      )}

      {/* Filter pills */}
      <div className="flex gap-2 flex-wrap">
        {FILTERS.map(f => (
          <button
            key={f.value}
            onClick={() => setFilter(f.value)}
            className={`text-xs px-3 py-1.5 rounded-full font-medium transition-colors border ${
              filter === f.value
                ? 'bg-indigo-600 text-white border-indigo-600'
                : 'border-slate-300 text-slate-600 hover:bg-slate-100'
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {isLoading ? (
        <p className="text-sm text-slate-400">Loading…</p>
      ) : (
        <Table>
          <thead>
            <tr>
              <Th>Title</Th>
              <Th>Type</Th>
              <Th>Status</Th>
              <Th>Project</Th>
              <Th>Raised By</Th>
              <Th>SLA Triggered</Th>
              <Th>Actions</Th>
            </tr>
          </thead>
          <tbody>
            {blockers?.map(b => (
              <Tr key={b._id}>
                <Td><span className="font-medium text-slate-900">{b.title}</span></Td>
                <Td>{b.type === 'client_side' ? 'Client-side' : 'Internal'}</Td>
                <Td>
                  <Badge variant={statusVariant(b.status)}>
                    {b.status === 'sla_triggered' ? 'SLA Triggered' : b.status.charAt(0).toUpperCase() + b.status.slice(1)}
                  </Badge>
                </Td>
                <Td>{b.project?.title ?? '—'}</Td>
                <Td>{b.raisedBy?.name ?? '—'}</Td>
                <Td className="text-slate-400 text-xs">
                  {b.slaTriggeredAt ? new Date(b.slaTriggeredAt).toLocaleDateString('en-IN') : '—'}
                </Td>
                <Td>
                  <div className="flex gap-1.5">
                    {b.status === 'open' && (
                      <Button variant="secondary" className="text-xs py-1 px-2" onClick={() => triggerSla.mutate(b._id)} disabled={triggerSla.isPending}>
                        Trigger SLA
                      </Button>
                    )}
                    {(b.status === 'open' || b.status === 'sla_triggered') && (
                      <Button variant="ghost" className="text-xs py-1 px-2 text-green-700 hover:bg-green-50" onClick={() => resolve.mutate(b._id)} disabled={resolve.isPending}>
                        Resolve
                      </Button>
                    )}
                    {b.status === 'resolved' && <span className="text-xs text-slate-400">—</span>}
                  </div>
                </Td>
              </Tr>
            ))}
            {blockers?.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-10 text-center text-sm text-slate-400">
                  No blockers found.
                </td>
              </tr>
            )}
          </tbody>
        </Table>
      )}
    </div>
  );
}
