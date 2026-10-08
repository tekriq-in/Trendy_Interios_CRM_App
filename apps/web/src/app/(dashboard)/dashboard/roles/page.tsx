'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';
import { Shield, Plus, Pencil, Trash2, X } from 'lucide-react';

interface Role {
  _id: string;
  name: string;
  permissions: string[];
  isSystem: boolean;
}

const PERMISSION_GROUPS: { label: string; slugs: string[] }[] = [
  { label: 'Users', slugs: ['users:read', 'users:create', 'users:edit', 'users:delete'] },
  { label: 'Roles', slugs: ['roles:read', 'roles:create', 'roles:edit', 'roles:delete'] },
  { label: 'Departments', slugs: ['departments:read', 'departments:create', 'departments:edit', 'departments:delete'] },
  { label: 'Clients', slugs: ['clients:read', 'clients:create', 'clients:edit'] },
  { label: 'Projects', slugs: ['projects:read_all', 'projects:read_own', 'projects:create', 'projects:edit', 'projects:advance_stage'] },
  { label: 'Tasks', slugs: ['tasks:create', 'tasks:edit', 'tasks:delete'] },
  { label: 'Handovers', slugs: ['handovers:raise', 'handovers:confirm_from', 'handovers:accept_to'] },
  { label: 'Purchase Items', slugs: ['purchase_items:manage'] },
  { label: 'Blockers', slugs: ['blockers:raise', 'blockers:trigger_sla', 'blockers:resolve'] },
  { label: 'Approvals', slugs: ['approvals:request', 'approvals:decide'] },
  { label: 'Payments', slugs: ['payments:record', 'payments:view_all'] },
  { label: 'Documents', slugs: ['documents:upload', 'documents:delete'] },
  { label: 'Messaging', slugs: ['messages:send'] },
  { label: 'Activity Log', slugs: ['activity_log:read'] },
  { label: 'SLA', slugs: ['sla:edit'] },
  { label: 'Dashboard', slugs: ['dashboard:view'] },
];

const SLUG_LABEL: Record<string, string> = {
  'users:read': 'View users', 'users:create': 'Create users', 'users:edit': 'Edit users', 'users:delete': 'Delete users',
  'roles:read': 'View roles', 'roles:create': 'Create roles', 'roles:edit': 'Edit roles', 'roles:delete': 'Delete roles',
  'departments:read': 'View depts', 'departments:create': 'Create depts', 'departments:edit': 'Edit depts', 'departments:delete': 'Delete depts',
  'clients:read': 'View clients', 'clients:create': 'Add clients', 'clients:edit': 'Edit clients',
  'projects:read_all': 'View all projects', 'projects:read_own': 'View own projects', 'projects:create': 'Create projects',
  'projects:edit': 'Edit projects', 'projects:advance_stage': 'Advance stage',
  'tasks:create': 'Create tasks', 'tasks:edit': 'Edit tasks', 'tasks:delete': 'Delete tasks',
  'handovers:raise': 'Raise handover', 'handovers:confirm_from': 'Confirm (from dept)', 'handovers:accept_to': 'Accept (to dept)',
  'purchase_items:manage': 'Manage purchase items',
  'blockers:raise': 'Raise blocker', 'blockers:trigger_sla': 'Trigger SLA', 'blockers:resolve': 'Resolve blocker',
  'approvals:request': 'Request approval', 'approvals:decide': 'Approve / Reject',
  'payments:record': 'Record payment', 'payments:view_all': 'View all payments',
  'documents:upload': 'Upload files', 'documents:delete': 'Delete files',
  'messages:send': 'Send messages',
  'activity_log:read': 'View activity log',
  'sla:edit': 'Edit SLA settings',
  'dashboard:view': 'View dashboard',
};

const EMPTY_FORM = { name: '', permissions: [] as string[] };

export default function RolesPage() {
  const qc = useQueryClient();
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<Role | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const { data: roles = [], isLoading } = useQuery<Role[]>({
    queryKey: ['roles'],
    queryFn: () => apiClient.get('/roles').then((r) => r.data),
  });

  const deleteMut = useMutation({
    mutationFn: (id: string) => apiClient.delete(`/roles/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['roles'] }),
  });

  function openCreate() {
    setEditing(null);
    setForm(EMPTY_FORM);
    setError('');
    setShowModal(true);
  }

  function openEdit(role: Role) {
    setEditing(role);
    setForm({ name: role.name, permissions: [...role.permissions] });
    setError('');
    setShowModal(true);
  }

  function togglePerm(slug: string) {
    setForm((prev) => ({
      ...prev,
      permissions: prev.permissions.includes(slug)
        ? prev.permissions.filter((p) => p !== slug)
        : [...prev.permissions, slug],
    }));
  }

  async function handleSave() {
    if (!form.name.trim()) { setError('Role name is required.'); return; }
    setSaving(true);
    setError('');
    try {
      if (editing) {
        await apiClient.patch(`/roles/${editing._id}`, form);
      } else {
        await apiClient.post('/roles', form);
      }
      qc.invalidateQueries({ queryKey: ['roles'] });
      setShowModal(false);
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { message?: string } } })?.response?.data?.message;
      setError(msg ?? 'Failed to save role.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Roles</h1>
          <p className="text-sm text-slate-500 mt-0.5">Define what each role can access across the system.</p>
        </div>
        <button onClick={openCreate} className="flex items-center gap-2 bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-semibold hover:bg-indigo-700 transition-colors">
          <Plus className="w-4 h-4" /> New Role
        </button>
      </div>

      {isLoading ? (
        <p className="text-sm text-slate-400">Loading…</p>
      ) : (
        <div className="grid gap-4">
          {roles.map((role) => (
            <div key={role._id} className="bg-white border border-slate-200 rounded-xl p-5">
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-lg bg-indigo-50 flex items-center justify-center">
                    <Shield className="w-4 h-4 text-indigo-600" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-slate-900">{role.name}</span>
                      {role.isSystem && (
                        <span className="text-xs px-2 py-0.5 bg-slate-100 text-slate-500 rounded-full">system</span>
                      )}
                    </div>
                    <p className="text-xs text-slate-400 mt-0.5">{role.permissions.length} permissions</p>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <button onClick={() => openEdit(role)} className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors">
                    <Pencil className="w-4 h-4" />
                  </button>
                  {!role.isSystem && (
                    <button
                      onClick={() => { if (confirm(`Delete role "${role.name}"?`)) deleteMut.mutate(role._id); }}
                      className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>

              {role.permissions.length > 0 && (
                <div className="mt-4 flex flex-wrap gap-1.5">
                  {role.permissions.map((p) => (
                    <span key={p} className="text-xs px-2 py-0.5 bg-slate-100 text-slate-600 rounded-md font-mono">
                      {p}
                    </span>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/40 pt-16 px-4 overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl mb-8">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
              <h2 className="text-lg font-semibold text-slate-900">{editing ? 'Edit Role' : 'New Role'}</h2>
              <button onClick={() => setShowModal(false)} className="p-1 text-slate-400 hover:text-slate-600 rounded-lg">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="px-6 py-5 space-y-5">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">Role name</label>
                <input
                  type="text"
                  value={form.name}
                  onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
                  placeholder="e.g. Site Supervisor"
                  disabled={editing?.isSystem}
                  className="w-full border border-slate-300 rounded-lg px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:bg-slate-50 disabled:text-slate-400"
                />
              </div>

              <div>
                <div className="text-sm font-medium text-slate-700 mb-3">Permissions</div>
                <div className="space-y-4 max-h-96 overflow-y-auto pr-1">
                  {PERMISSION_GROUPS.map((group) => (
                    <div key={group.label}>
                      <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">{group.label}</div>
                      <div className="grid grid-cols-2 gap-1.5">
                        {group.slugs.map((slug) => (
                          <label key={slug} className="flex items-center gap-2.5 px-3 py-2 rounded-lg border border-slate-200 hover:border-indigo-300 hover:bg-indigo-50/50 cursor-pointer transition-colors">
                            <input
                              type="checkbox"
                              checked={form.permissions.includes(slug)}
                              onChange={() => togglePerm(slug)}
                              className="w-3.5 h-3.5 accent-indigo-600"
                            />
                            <span className="text-xs text-slate-700">{SLUG_LABEL[slug] ?? slug}</span>
                          </label>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {error && <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</p>}
            </div>

            <div className="flex justify-end gap-3 px-6 py-4 border-t border-slate-200">
              <button onClick={() => setShowModal(false)} className="px-4 py-2 text-sm text-slate-600 hover:text-slate-900 font-medium">Cancel</button>
              <button onClick={handleSave} disabled={saving} className="px-4 py-2 bg-indigo-600 text-white text-sm font-semibold rounded-lg hover:bg-indigo-700 disabled:opacity-50 transition-colors">
                {saving ? 'Saving…' : editing ? 'Save changes' : 'Create role'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
