'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, X, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { apiClient } from '@/lib/api-client';
import type { Blocker } from '@ti/shared';
import { Table, Th, Td, Tr } from '@/components/ui/Table';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { PageHeader } from '@/components/ui/PageHeader';
import { SkeletonRow } from '@/components/ui/Skeleton';
import { EmptyState } from '@/components/ui/EmptyState';

type BlockerPopulated = Blocker & {
  project?: { _id: string; title: string };
  raisedBy?: { name: string };
};

interface Project { _id: string; title: string; }

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

  const { data: projects = [] } = useQuery<Project[]>({
    queryKey: ['projects'],
    queryFn: () => apiClient.get('/projects').then(r => r.data),
    enabled: showForm,
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
        description="Track and resolve issues that are holding up a project"
        action={
          <Button variant={showForm ? 'secondary' : 'primary'} onClick={() => { setShowForm(v => !v); setForm(EMPTY_FORM); }}>
            {showForm ? <><X className="w-4 h-4" /> Cancel</> : <><Plus className="w-4 h-4" /> Report a Blocker</>}
          </Button>
        }
      />

      {showForm && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
          <h2 className="text-base font-semibold text-slate-800 mb-4">Report a New Blocker</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="sm:col-span-2">
              <label className="block text-sm font-medium text-slate-700 mb-1.5">What is blocking progress? *</label>
              <input
                className={inputCls}
                placeholder="e.g. Material delivery delayed by supplier"
                value={form.title}
                onChange={e => setForm({ ...form, title: e.target.value })}
              />
            </div>
            <div className="sm:col-span-2">
              <label className="block text-sm font-medium text-slate-700 mb-1.5">More details (optional)</label>
              <textarea
                className={inputCls}
                placeholder="Describe the problem in more detail…"
                rows={2}
                value={form.description}
                onChange={e => setForm({ ...form, description: e.target.value })}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Who is responsible for the delay?</label>
              <select className={inputCls} value={form.type} onChange={e => setForm({ ...form, type: e.target.value as RaiseForm['type'] })}>
                <option value="internal">Our team (internal)</option>
                <option value="client_side">The client</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Which project is affected? *</label>
              <select
                className={inputCls}
                value={form.projectId}
                onChange={e => setForm({ ...form, projectId: e.target.value })}
              >
                <option value="">Select a project…</option>
                {projects.map(p => <option key={p._id} value={p._id}>{p.title}</option>)}
              </select>
            </div>
            <div className="sm:col-span-2">
              <Button
                onClick={() => raise.mutate(form)}
                disabled={raise.isPending || !form.title.trim() || !form.projectId}
              >
                {raise.isPending ? 'Submitting…' : 'Submit Blocker'}
              </Button>
              {raise.isError && <p className="text-sm text-red-600 mt-2">Something went wrong. Please try again.</p>}
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
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          {Array.from({ length: 4 }).map((_, i) => <SkeletonRow key={i} />)}
        </div>
      ) : (blockers?.length === 0) ? (
        <div className="bg-white rounded-xl border border-slate-200">
          <EmptyState
            icon={CheckCircle2}
            title="No blockers found"
            description="Great news — no blockers are currently reported for this filter."
          />
        </div>
      ) : (
        <Table>
          <thead>
            <tr>
              <Th>Issue</Th>
              <Th>Type</Th>
              <Th>Status</Th>
              <Th>Project</Th>
              <Th>Reported By</Th>
              <Th>SLA Date</Th>
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
                  <div className="flex gap-2 flex-wrap">
                    {b.status === 'open' && (
                      <button
                        onClick={() => triggerSla.mutate(b._id)}
                        disabled={triggerSla.isPending}
                        className="flex items-center gap-1.5 text-xs font-semibold bg-red-50 text-red-700 border border-red-200 px-3 py-1.5 rounded-lg hover:bg-red-100 disabled:opacity-50 transition-colors"
                      >
                        <AlertTriangle className="w-3.5 h-3.5" />
                        Trigger SLA
                      </button>
                    )}
                    {(b.status === 'open' || b.status === 'sla_triggered') && (
                      <button
                        onClick={() => resolve.mutate(b._id)}
                        disabled={resolve.isPending}
                        className="flex items-center gap-1.5 text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200 px-3 py-1.5 rounded-lg hover:bg-emerald-100 disabled:opacity-50 transition-colors"
                      >
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        Mark Resolved
                      </button>
                    )}
                    {b.status === 'resolved' && <span className="text-xs text-slate-400">Resolved</span>}
                  </div>
                </Td>
              </Tr>
            ))}
          </tbody>
        </Table>
      )}
    </div>
  );
}
