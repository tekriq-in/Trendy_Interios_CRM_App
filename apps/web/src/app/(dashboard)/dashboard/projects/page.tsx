'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { apiClient } from '@/lib/api-client';
import { PERMISSIONS } from '@ti/shared';
import { usePermissions } from '@/lib/usePermissions';
import { SkeletonRow } from '@/components/ui/Skeleton';
import { EmptyState } from '@/components/ui/EmptyState';
import { Plus, X, FolderKanban, LayoutList, Columns3 } from 'lucide-react';

interface Client { _id: string; name: string; isActive?: boolean; }
interface Dept { _id: string; name: string; order: number; }
interface Project {
  _id: string; title: string; status: string; progressPct: number;
  client?: Client | string;
  currentStage?: Dept | string;
}

const STATUS_COLORS: Record<string, string> = {
  active: 'bg-emerald-50 text-emerald-700',
  on_hold: 'bg-amber-50 text-amber-700',
  completed: 'bg-blue-50 text-blue-700',
  cancelled: 'bg-red-50 text-red-700',
};

const EMPTY_FORM = { clientId: '', title: '', firstStageId: '', targetDate: '' };
type FormState = typeof EMPTY_FORM;

type ViewMode = 'list' | 'board';

export default function ProjectsPage() {
  const { hasPermission } = usePermissions();
  const canCreateProject = hasPermission(PERMISSIONS.PROJECTS_CREATE);
  const router = useRouter();
  const qc = useQueryClient();
  const [viewMode, setViewMode] = useState<ViewMode>('list');
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');
  const [fieldErrors, setFieldErrors] = useState<Partial<Record<keyof FormState, string>>>({});
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  const { data: projects = [], isLoading } = useQuery<Project[]>({
    queryKey: ['projects'],
    queryFn: () => apiClient.get('/projects').then((r) => r.data),
  });

  const { data: clients = [] } = useQuery<Client[]>({
    queryKey: ['clients'],
    queryFn: () => apiClient.get('/clients').then((r) => r.data),
  });

  const { data: departments = [] } = useQuery<Dept[]>({
    queryKey: ['departments'],
    queryFn: () => apiClient.get('/departments').then((r) => r.data),
  });

  const sortedDepts = [...departments].sort((a, b) => a.order - b.order);

  const filteredProjects = projects.filter((p) => {
    const q = search.toLowerCase();
    const titleMatch = p.title.toLowerCase().includes(q);
    const clientName = typeof p.client === 'object' && p.client ? (p.client.name ?? '').toLowerCase() : '';
    const clientMatch = clientName.includes(q);
    const statusMatch = !statusFilter || p.status === statusFilter;
    return (titleMatch || clientMatch) && statusMatch;
  });

  function set(key: keyof FormState, value: string) {
    setForm((p) => ({ ...p, [key]: value }));
    if (fieldErrors[key]) setFieldErrors((p) => ({ ...p, [key]: '' }));
  }

  async function handleCreate() {
    const errors: Partial<Record<keyof FormState, string>> = {};
    if (!form.clientId) errors.clientId = 'Please select a client.';
    if (!form.title.trim()) errors.title = 'Project title is required.';
    if (Object.keys(errors).length) { setFieldErrors(errors); return; }
    setSaving(true); setErr(''); setFieldErrors({});
    try {
      const res = await apiClient.post<Project>('/projects', {
        clientId: form.clientId,
        title: form.title.trim(),
        firstStageId: form.firstStageId || undefined,
        targetDate: form.targetDate || undefined,
      });
      qc.invalidateQueries({ queryKey: ['projects'] });
      setShowModal(false);
      router.push(`/dashboard/projects/${res.data._id}`);
    } catch (e: unknown) {
      setErr((e as { response?: { data?: { message?: string } } })?.response?.data?.message ?? 'Failed to create project.');
    } finally { setSaving(false); }
  }

  const inputCls = (field?: keyof FormState) =>
    `w-full border rounded-lg px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 ${field && fieldErrors[field] ? 'border-red-400 bg-red-50' : 'border-slate-300'}`;
  const labelCls = 'block text-sm font-medium text-slate-700 mb-1.5';
  const fieldErr = (field: keyof FormState) =>
    fieldErrors[field] ? <p className="text-xs text-red-600 mt-1">{fieldErrors[field]}</p> : null;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Projects</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            {filteredProjects.length} of {projects.length} project{projects.length !== 1 ? 's' : ''}
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by title or client…"
            className="border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 w-48"
          />
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            <option value="">All statuses</option>
            <option value="active">Active</option>
            <option value="on_hold">On Hold</option>
            <option value="completed">Completed</option>
            <option value="cancelled">Cancelled</option>
          </select>
          {/* View toggle */}
          <div className="flex rounded-lg border border-slate-200 overflow-hidden">
            <button
              onClick={() => setViewMode('list')}
              className={`px-2.5 py-2 transition-colors ${viewMode === 'list' ? 'bg-indigo-600 text-white' : 'text-slate-500 hover:bg-slate-50'}`}
              title="List view"
            >
              <LayoutList className="w-4 h-4" />
            </button>
            <button
              onClick={() => setViewMode('board')}
              className={`px-2.5 py-2 transition-colors ${viewMode === 'board' ? 'bg-indigo-600 text-white' : 'text-slate-500 hover:bg-slate-50'}`}
              title="Board view"
            >
              <Columns3 className="w-4 h-4" />
            </button>
          </div>
          {canCreateProject && (
            <button onClick={() => { setForm(EMPTY_FORM); setErr(''); setShowModal(true); }} className="flex items-center gap-2 bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-semibold hover:bg-indigo-700 transition-colors whitespace-nowrap">
              <Plus className="w-4 h-4" /> New Project
            </button>
          )}
        </div>
      </div>

      {isLoading ? (
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          {Array.from({ length: 5 }).map((_, i) => <SkeletonRow key={i} />)}
        </div>
      ) : projects.length === 0 ? (
        <div className="bg-white rounded-xl border border-slate-200">
          <EmptyState
            icon={FolderKanban}
            title="No projects yet"
            description="Start by creating your first interior project. Each project tracks stages, tasks, and handovers end-to-end."
            action={canCreateProject ? { label: '+ New Project', onClick: () => { setForm(EMPTY_FORM); setErr(''); setShowModal(true); } } : undefined}
          />
        </div>
      ) : viewMode === 'list' ? (
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase">Title</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase">Client</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase">Current Stage</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase">Progress</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredProjects.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-10 text-center text-slate-400 text-sm">
                    No projects match your search.
                  </td>
                </tr>
              )}
              {filteredProjects.map((p) => (
                <tr
                  key={p._id}
                  onClick={() => router.push(`/dashboard/projects/${p._id}`)}
                  className="hover:bg-slate-50 cursor-pointer transition-colors"
                >
                  <td className="px-4 py-3 font-medium text-slate-800">{p.title}</td>
                  <td className="px-4 py-3 text-slate-500">
                    {typeof p.client === 'object' && p.client ? p.client.name : (p.client ?? '—')}
                  </td>
                  <td className="px-4 py-3 text-slate-500">
                    {typeof p.currentStage === 'object' && p.currentStage ? p.currentStage.name : '—'}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <div className="flex-1 h-1.5 bg-slate-200 rounded-full overflow-hidden min-w-[60px]">
                        <div className="h-full bg-indigo-500 rounded-full" style={{ width: `${p.progressPct ?? 0}%` }} />
                      </div>
                      <span className="text-xs text-slate-400 w-8 text-right font-mono">{p.progressPct ?? 0}%</span>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`text-xs px-2.5 py-0.5 rounded-full font-semibold ${STATUS_COLORS[p.status] ?? 'bg-slate-100 text-slate-600'}`}>
                      {p.status.replace('_', ' ')}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        /* Board / Kanban view — grouped by current stage */
        (() => {
          const stageGroups = new Map<string, { label: string; projects: Project[] }>();
          const noStage = { label: 'No Stage', projects: [] as Project[] };

          for (const p of filteredProjects) {
            const stageName = typeof p.currentStage === 'object' && p.currentStage ? p.currentStage.name : null;
            if (!stageName) { noStage.projects.push(p); continue; }
            if (!stageGroups.has(stageName)) stageGroups.set(stageName, { label: stageName, projects: [] });
            stageGroups.get(stageName)!.projects.push(p);
          }

          const columns = [...sortedDepts.map((d) => stageGroups.get(d.name) ?? { label: d.name, projects: [] })];
          if (noStage.projects.length > 0) columns.push(noStage);

          return (
            <div className="overflow-x-auto pb-4">
              <div className="flex gap-4 min-w-max items-start">
                {columns.filter((col) => col.projects.length > 0 || sortedDepts.some((d) => d.name === col.label)).map((col) => (
                  <div key={col.label} className="w-64 shrink-0">
                    <div className="flex items-center gap-2 mb-3 px-1">
                      <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">{col.label}</span>
                      <span className="text-xs bg-slate-100 text-slate-500 font-semibold rounded-full px-1.5 py-0.5">{col.projects.length}</span>
                    </div>
                    <div className="space-y-3">
                      {col.projects.length === 0 && (
                        <div className="border-2 border-dashed border-slate-200 rounded-xl h-20 flex items-center justify-center">
                          <span className="text-xs text-slate-300">Empty</span>
                        </div>
                      )}
                      {col.projects.map((p) => (
                        <div
                          key={p._id}
                          onClick={() => router.push(`/dashboard/projects/${p._id}`)}
                          className="bg-white border border-slate-200 rounded-xl p-3.5 cursor-pointer hover:border-indigo-300 hover:shadow-sm transition-all space-y-2.5"
                        >
                          <div>
                            <p className="text-sm font-semibold text-slate-900 leading-snug">{p.title}</p>
                            <p className="text-xs text-slate-400 mt-0.5">
                              {typeof p.client === 'object' && p.client ? p.client.name : ''}
                            </p>
                          </div>
                          <div className="flex items-center gap-2">
                            <div className="flex-1 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                              <div className="h-full bg-indigo-500 rounded-full" style={{ width: `${p.progressPct ?? 0}%` }} />
                            </div>
                            <span className="text-[10px] text-slate-400 font-mono">{p.progressPct ?? 0}%</span>
                          </div>
                          <span className={`inline-block text-[10px] px-2 py-0.5 rounded-full font-semibold ${STATUS_COLORS[p.status] ?? 'bg-slate-100 text-slate-600'}`}>
                            {p.status.replace('_', ' ')}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          );
        })()
      )}

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/40 pt-20 px-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
              <h2 className="text-lg font-semibold text-slate-900">New Project</h2>
              <button onClick={() => setShowModal(false)} className="p-1 text-slate-400 hover:text-slate-600 rounded-lg"><X className="w-5 h-5" /></button>
            </div>
            <div className="px-6 py-5 space-y-4">
              <div>
                <label className={labelCls}>Client *</label>
                <select value={form.clientId} onChange={(e) => set('clientId', e.target.value)} className={inputCls('clientId')}>
                  <option value="">Select client…</option>
                  {clients.filter((c) => c.isActive !== false).map((c) => <option key={c._id} value={c._id}>{c.name}</option>)}
                </select>
                {fieldErr('clientId')}
              </div>
              <div>
                <label className={labelCls}>Project title *</label>
                <input type="text" value={form.title} onChange={(e) => set('title', e.target.value)} placeholder="e.g. Sharma Residence — Hall" className={inputCls('title')} />
                {fieldErr('title')}
              </div>
              <div>
                <label className={labelCls}>Starting stage</label>
                <select value={form.firstStageId} onChange={(e) => set('firstStageId', e.target.value)} className={inputCls()}>
                  <option value="">Default (first department)</option>
                  {sortedDepts.map((d) => <option key={d._id} value={d._id}>{d.order}. {d.name}</option>)}
                </select>
              </div>
              <div>
                <label className={labelCls}>Target date</label>
                <input type="date" value={form.targetDate} onChange={(e) => set('targetDate', e.target.value)} className={inputCls()} />
              </div>
              {err && <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{err}</p>}
            </div>
            <div className="flex justify-end gap-3 px-6 py-4 border-t border-slate-200">
              <button onClick={() => setShowModal(false)} className="px-4 py-2 text-sm text-slate-600 font-medium">Cancel</button>
              <button onClick={handleCreate} disabled={saving} className="px-4 py-2 bg-indigo-600 text-white text-sm font-semibold rounded-lg hover:bg-indigo-700 disabled:opacity-50 transition-colors">
                {saving ? 'Creating…' : 'Create project'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
