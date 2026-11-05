'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { apiClient } from '@/lib/api-client';
import { PERMISSIONS } from '@ti/shared';
import { usePermissions } from '@/lib/usePermissions';
import { UserPlus, Pencil, X, Phone, Mail, MapPin, FolderPlus, UserCircle2, UserX, UserCheck } from 'lucide-react';
import { EmptyState } from '@/components/ui/EmptyState';

interface Client {
  _id: string; name: string; phone: string; email?: string;
  address?: string; leadSource?: string; whatsappOptIn?: boolean; notes?: string;
  isActive?: boolean;
}
interface Dept { _id: string; name: string; order: number; }

const LEAD_SOURCES = ['marketing', 'referral', 'walkin', 'other'];

const EMPTY_FORM = {
  name: '', phone: '', email: '', address: '',
  leadSource: 'walkin', referredBy: '', notes: '', whatsappOptIn: true,
};
type FormState = typeof EMPTY_FORM;

export default function ClientsPage() {
  const { hasPermission } = usePermissions();
  const canCreateClient = hasPermission(PERMISSIONS.CLIENTS_CREATE);
  const canCreateProject = hasPermission(PERMISSIONS.PROJECTS_CREATE);
  const router = useRouter();
  const qc = useQueryClient();
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<Client | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [search, setSearch] = useState('');
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');
  const [fieldErrors, setFieldErrors] = useState<Partial<Record<keyof FormState, string>>>({});
  const [showInactive, setShowInactive] = useState(false);

  // New project after client creation
  const [newClientId, setNewClientId] = useState<string | null>(null);
  const [showProjectModal, setShowProjectModal] = useState(false);
  const [projectForm, setProjectForm] = useState({ title: '', firstStageId: '' });
  const [projectSaving, setProjectSaving] = useState(false);

  const deactivateMut = useMutation({
    mutationFn: (id: string) => apiClient.patch(`/clients/${id}/deactivate`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['clients'] }),
  });

  const reactivateMut = useMutation({
    mutationFn: (id: string) => apiClient.patch(`/clients/${id}/reactivate`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['clients'] }),
  });

  const { data: clients = [], isLoading } = useQuery<Client[]>({
    queryKey: ['clients', search, showInactive],
    queryFn: () => {
      const params = new URLSearchParams();
      if (search) params.set('search', search);
      if (showInactive) params.set('includeInactive', 'true');
      const qs = params.toString();
      return apiClient.get(`/clients${qs ? `?${qs}` : ''}`).then(r => r.data);
    },
  });

  const { data: departments = [] } = useQuery<Dept[]>({
    queryKey: ['departments'],
    queryFn: () => apiClient.get('/departments').then(r => r.data),
  });

  const sortedDepts = [...departments].sort((a, b) => a.order - b.order);

  function set(key: keyof FormState, value: string | boolean) {
    setForm(p => ({ ...p, [key]: value }));
    if (typeof value === 'string' && fieldErrors[key]) setFieldErrors(p => ({ ...p, [key]: '' }));
  }

  function openCreate() {
    setEditing(null);
    setForm(EMPTY_FORM);
    setErr('');
    setFieldErrors({});
    setShowModal(true);
  }

  function openEdit(c: Client) {
    setEditing(c);
    setForm({
      name: c.name, phone: c.phone, email: c.email ?? '', address: c.address ?? '',
      leadSource: c.leadSource ?? 'walkin', referredBy: '',
      notes: c.notes ?? '', whatsappOptIn: c.whatsappOptIn ?? false,
    });
    setErr('');
    setFieldErrors({});
    setShowModal(true);
  }

  async function handleSave() {
    const errors: Partial<Record<keyof FormState, string>> = {};
    if (!form.name.trim()) {
      errors.name = 'Client name is required.';
    } else if (form.name.trim().length < 2) {
      errors.name = 'Name must be at least 2 characters.';
    }
    if (!form.phone.trim()) {
      errors.phone = 'Phone number is required.';
    } else {
      const digits = form.phone.replace(/\D/g, '');
      if (digits.length !== 10) {
        errors.phone = 'Phone number must be exactly 10 digits.';
      }
    }
    if (form.email.trim() && !/^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(form.email.trim())) {
      errors.email = 'Enter a valid email address (e.g. name@example.com).';
    }
    if (Object.keys(errors).length) { setFieldErrors(errors); return; }
    setSaving(true); setErr(''); setFieldErrors({});
    try {
      const payload = {
        name: form.name.trim(), phone: form.phone.trim(),
        email: form.email.trim() || undefined, address: form.address.trim() || undefined,
        leadSource: form.leadSource, referredBy: form.referredBy.trim() || undefined,
        notes: form.notes.trim() || undefined, whatsappOptIn: form.whatsappOptIn,
      };
      if (editing) {
        await apiClient.patch(`/clients/${editing._id}`, payload);
        qc.invalidateQueries({ queryKey: ['clients'] });
        setShowModal(false);
      } else {
        const res = await apiClient.post<Client>('/clients', payload);
        qc.invalidateQueries({ queryKey: ['clients'] });
        setShowModal(false);
        // Offer to start a project
        if (canCreateProject) {
          setNewClientId(res.data._id);
          setProjectForm({ title: '', firstStageId: sortedDepts[0]?._id ?? '' });
          setShowProjectModal(true);
        }
      }
    } catch (e: unknown) {
      const raw = (e as { response?: { data?: { message?: string | string[] } } })?.response?.data?.message;
      setErr(Array.isArray(raw) ? raw.join(', ') : (raw ?? 'Failed to save.'));
    } finally { setSaving(false); }
  }

  async function handleCreateProject() {
    if (!projectForm.title.trim() || !newClientId) return;
    setProjectSaving(true);
    try {
      const res = await apiClient.post<{ _id: string }>('/projects', {
        clientId: newClientId,
        title: projectForm.title.trim(),
        firstStageId: projectForm.firstStageId || undefined,
      });
      qc.invalidateQueries({ queryKey: ['projects'] });
      setShowProjectModal(false);
      router.push(`/dashboard/projects/${res.data._id}`);
    } catch {
      // silent — user can create project manually
      setShowProjectModal(false);
    } finally { setProjectSaving(false); }
  }

  const inputCls = (field?: keyof FormState) =>
    `w-full border rounded-lg px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 ${field && fieldErrors[field] ? 'border-red-400 bg-red-50' : 'border-slate-300'}`;
  const labelCls = 'block text-sm font-medium text-slate-700 mb-1.5';
  const fieldErr = (field: keyof FormState) =>
    fieldErrors[field] ? <p className="text-xs text-red-600 mt-1">{fieldErrors[field]}</p> : null;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Clients</h1>
          <p className="text-sm text-slate-500 mt-0.5">All client enquiries and onboarded customers.</p>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          <input
            type="text" value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Search by name or phone…"
            className="border border-slate-300 rounded-lg px-3.5 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 w-56"
          />
          <label className="flex items-center gap-2 text-sm text-slate-600 cursor-pointer">
            <input type="checkbox" checked={showInactive} onChange={e => setShowInactive(e.target.checked)} className="w-4 h-4 accent-indigo-600" />
            Show inactive
          </label>
          {canCreateClient && (
            <button onClick={openCreate} className="flex items-center gap-2 bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-semibold hover:bg-indigo-700 transition-colors whitespace-nowrap">
              <UserPlus className="w-4 h-4" /> Add Client
            </button>
          )}
        </div>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="bg-white border border-slate-200 rounded-xl p-4 space-y-3 animate-pulse">
              <div className="h-4 bg-slate-200 rounded w-2/3" />
              <div className="h-3 bg-slate-200 rounded w-1/3" />
              <div className="h-3 bg-slate-200 rounded w-1/2" />
            </div>
          ))}
        </div>
      ) : clients.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-xl">
          <EmptyState
            icon={UserCircle2}
            title="No clients yet"
            description="Add your first client to start tracking interior projects, follow-ups, and payment milestones."
            action={canCreateClient ? { label: '+ Add Client', onClick: openCreate } : undefined}
          />
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {clients.map(c => (
            <div key={c._id} className={`bg-white border rounded-xl p-4 space-y-3 transition-colors ${c.isActive === false ? 'border-slate-200 opacity-60' : 'border-slate-200 hover:border-indigo-300'}`}>
              <div className="flex items-start justify-between gap-2">
                <div>
                  <div className="flex items-center gap-2">
                    <div className="font-semibold text-slate-900">{c.name}</div>
                    {c.isActive === false && (
                      <span className="text-xs px-2 py-0.5 rounded-full bg-red-50 text-red-600 font-medium">Inactive</span>
                    )}
                  </div>
                  {c.leadSource && (
                    <span className="text-xs px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-600 font-medium capitalize">{c.leadSource}</span>
                  )}
                </div>
                <div className="flex gap-1 shrink-0">
                  <button onClick={() => openEdit(c)} className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors">
                    <Pencil className="w-3.5 h-3.5" />
                  </button>
                  {c.isActive !== false ? (
                    <>
                      {canCreateProject && <button
                        onClick={() => { setNewClientId(c._id); setProjectForm({ title: '', firstStageId: sortedDepts[0]?._id ?? '' }); setShowProjectModal(true); }}
                        className="p-1.5 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors"
                        title="Create project for this client"
                      >
                        <FolderPlus className="w-3.5 h-3.5" />
                      </button>}
                      <button
                        onClick={() => deactivateMut.mutate(c._id)}
                        className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                        title="Deactivate client"
                      >
                        <UserX className="w-3.5 h-3.5" />
                      </button>
                    </>
                  ) : (
                    <button
                      onClick={() => reactivateMut.mutate(c._id)}
                      className="p-1.5 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors"
                      title="Reactivate client"
                    >
                      <UserCheck className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>
              <div className="space-y-1.5">
                <div className="flex items-center gap-2 text-sm text-slate-600">
                  <Phone className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                  <span>{c.phone}</span>
                  {c.whatsappOptIn && <span className="text-xs bg-emerald-50 text-emerald-600 px-1.5 py-0.5 rounded font-medium">WhatsApp ✓</span>}
                </div>
                {c.email && (
                  <div className="flex items-center gap-2 text-sm text-slate-500">
                    <Mail className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                    <span className="truncate">{c.email}</span>
                  </div>
                )}
                {c.address && (
                  <div className="flex items-center gap-2 text-sm text-slate-500">
                    <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                    <span className="truncate">{c.address}</span>
                  </div>
                )}
                {c.notes && <p className="text-xs text-slate-400 italic pt-1">"{c.notes}"</p>}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add/Edit Client Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/40 pt-12 px-4 overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg mb-8">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
              <h2 className="text-lg font-semibold text-slate-900">{editing ? 'Edit Client' : 'Add Client'}</h2>
              <button onClick={() => setShowModal(false)} className="p-1 text-slate-400 hover:text-slate-600 rounded-lg"><X className="w-5 h-5" /></button>
            </div>
            <div className="px-6 py-5 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <label className={labelCls}>Full name *</label>
                  <input type="text" value={form.name} onChange={e => set('name', e.target.value)} placeholder="Rajesh Sharma" className={inputCls('name')} />
                  {fieldErr('name')}
                </div>
                <div>
                  <label className={labelCls}>Phone *</label>
                  <input type="tel" value={form.phone} onChange={e => set('phone', e.target.value)} placeholder="+91 98765 43210" className={inputCls('phone')} />
                  {fieldErr('phone')}
                </div>
                <div>
                  <label className={labelCls}>Email</label>
                  <input type="email" value={form.email} onChange={e => set('email', e.target.value)} placeholder="raj@example.com" autoComplete="off" className={inputCls('email')} />
                  {fieldErr('email')}
                </div>
                <div className="col-span-2">
                  <label className={labelCls}>Address</label>
                  <input type="text" value={form.address} onChange={e => set('address', e.target.value)} placeholder="123 Anna Nagar, Chennai" className={inputCls()} />
                </div>
                <div>
                  <label className={labelCls}>Lead source</label>
                  <select value={form.leadSource} onChange={e => set('leadSource', e.target.value)} className={inputCls()}>
                    {LEAD_SOURCES.map(s => <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>)}
                  </select>
                </div>
                <div>
                  <label className={labelCls}>Referred by</label>
                  <input type="text" value={form.referredBy} onChange={e => set('referredBy', e.target.value)} placeholder="Name of referrer" className={inputCls()} />
                </div>
                <div className="col-span-2">
                  <label className={labelCls}>Notes</label>
                  <textarea value={form.notes} onChange={e => set('notes', e.target.value)} rows={2} placeholder="Any additional notes…" className={`${inputCls()} resize-none`} />
                </div>
                <div className="col-span-2 flex items-center gap-3">
                  <input id="wa" type="checkbox" checked={form.whatsappOptIn} onChange={e => set('whatsappOptIn', e.target.checked)} className="w-4 h-4 accent-indigo-600" />
                  <label htmlFor="wa" className="text-sm font-medium text-slate-700">WhatsApp opt-in (client agrees to receive updates)</label>
                </div>
              </div>
              {err && <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{err}</p>}
            </div>
            <div className="flex justify-end gap-3 px-6 py-4 border-t border-slate-200">
              <button onClick={() => setShowModal(false)} className="px-4 py-2 text-sm text-slate-600 font-medium">Cancel</button>
              <button onClick={handleSave} disabled={saving} className="px-4 py-2 bg-indigo-600 text-white text-sm font-semibold rounded-lg hover:bg-indigo-700 disabled:opacity-50 transition-colors">
                {saving ? 'Saving…' : editing ? 'Save changes' : 'Add client'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Create Project Modal */}
      {showProjectModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
              <h2 className="text-lg font-semibold text-slate-900">Start a Project</h2>
              <button onClick={() => setShowProjectModal(false)} className="p-1 text-slate-400 hover:text-slate-600 rounded-lg"><X className="w-5 h-5" /></button>
            </div>
            <div className="px-6 py-5 space-y-4">
              <p className="text-sm text-slate-500">Create a project for this client and assign a starting department.</p>
              <div>
                <label className={labelCls}>Project title *</label>
                <input type="text" value={projectForm.title} onChange={e => setProjectForm(p => ({ ...p, title: e.target.value }))} placeholder="e.g. Hall renovation" className={inputCls()} />
              </div>
              <div>
                <label className={labelCls}>Starting department</label>
                <select value={projectForm.firstStageId} onChange={e => setProjectForm(p => ({ ...p, firstStageId: e.target.value }))} className={inputCls()}>
                  {sortedDepts.map(d => <option key={d._id} value={d._id}>{d.order}. {d.name}</option>)}
                </select>
              </div>
            </div>
            <div className="flex justify-end gap-3 px-6 py-4 border-t border-slate-200">
              <button onClick={() => setShowProjectModal(false)} className="px-4 py-2 text-sm text-slate-600 font-medium">Skip</button>
              <button onClick={handleCreateProject} disabled={!projectForm.title.trim() || projectSaving} className="px-4 py-2 bg-indigo-600 text-white text-sm font-semibold rounded-lg hover:bg-indigo-700 disabled:opacity-50 transition-colors">
                {projectSaving ? 'Creating…' : 'Create & open project'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
