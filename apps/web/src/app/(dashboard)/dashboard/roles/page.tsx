'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';
import {
  Shield, Plus, Pencil, Trash2, X, Search, CheckSquare, Square, ChevronDown, ChevronRight,
} from 'lucide-react';
import { SkeletonRow } from '@/components/ui/Skeleton';

interface Role {
  _id: string;
  name: string;
  permissions: string[];
  isSystem: boolean;
}

const PERMISSION_GROUPS: { label: string; color: string; slugs: string[] }[] = [
  { label: 'Users',          color: 'bg-indigo-50 text-indigo-700 border-indigo-200',   slugs: ['users:read', 'users:create', 'users:edit', 'users:delete', 'users:reset_password'] },
  { label: 'Roles',          color: 'bg-violet-50 text-violet-700 border-violet-200',   slugs: ['roles:read', 'roles:create', 'roles:edit', 'roles:delete'] },
  { label: 'Departments',    color: 'bg-sky-50 text-sky-700 border-sky-200',             slugs: ['departments:read', 'departments:create', 'departments:edit', 'departments:delete'] },
  { label: 'Clients',        color: 'bg-teal-50 text-teal-700 border-teal-200',          slugs: ['clients:read', 'clients:create', 'clients:edit', 'clients:delete'] },
  { label: 'Projects',       color: 'bg-emerald-50 text-emerald-700 border-emerald-200', slugs: ['projects:read_all', 'projects:read_own', 'projects:create', 'projects:edit', 'projects:advance_stage'] },
  { label: 'Tasks',          color: 'bg-lime-50 text-lime-700 border-lime-200',          slugs: ['tasks:create', 'tasks:edit', 'tasks:delete'] },
  { label: 'Handovers',      color: 'bg-amber-50 text-amber-700 border-amber-200',       slugs: ['handovers:raise', 'handovers:confirm_from', 'handovers:accept_to'] },
  { label: 'Purchase',       color: 'bg-orange-50 text-orange-700 border-orange-200',    slugs: ['purchase_items:add', 'purchase_items:manage'] },
  { label: 'Blockers',       color: 'bg-rose-50 text-rose-700 border-rose-200',          slugs: ['blockers:raise', 'blockers:trigger_sla', 'blockers:resolve'] },
  { label: 'Approvals',      color: 'bg-pink-50 text-pink-700 border-pink-200',          slugs: ['approvals:request', 'approvals:decide'] },
  { label: 'Documents',      color: 'bg-cyan-50 text-cyan-700 border-cyan-200',          slugs: ['documents:upload', 'documents:delete'] },
  { label: 'Messaging',      color: 'bg-blue-50 text-blue-700 border-blue-200',          slugs: ['messages:send'] },
  { label: 'Activity Log',   color: 'bg-slate-100 text-slate-600 border-slate-200',      slugs: ['activity_log:read'] },
  { label: 'SLA',            color: 'bg-yellow-50 text-yellow-700 border-yellow-200',    slugs: ['sla:edit'] },
  { label: 'Dashboard',      color: 'bg-indigo-50 text-indigo-600 border-indigo-200',    slugs: ['dashboard:view'] },
];

const SLUG_LABEL: Record<string, string> = {
  'users:read': 'View users',            'users:create': 'Create users',      'users:edit': 'Edit users',          'users:delete': 'Delete users', 'users:reset_password': 'Reset passwords',
  'roles:read': 'View roles',            'roles:create': 'Create roles',      'roles:edit': 'Edit roles',          'roles:delete': 'Delete roles',
  'departments:read': 'View',            'departments:create': 'Create',      'departments:edit': 'Edit',          'departments:delete': 'Delete',
  'clients:read': 'View clients',        'clients:create': 'Add clients',     'clients:edit': 'Edit clients', 'clients:delete': 'Permanently delete clients',
  'projects:read_all': 'View all',       'projects:read_own': 'View own',     'projects:create': 'Create',         'projects:edit': 'Edit',           'projects:advance_stage': 'Advance stage',
  'tasks:create': 'Create',             'tasks:edit': 'Edit',                'tasks:delete': 'Delete',
  'handovers:raise': 'Raise',           'handovers:confirm_from': 'Confirm', 'handovers:accept_to': 'Accept',
  'purchase_items:add': 'Add items (Design)', 'purchase_items:manage': 'Update ordered / received',
  'blockers:raise': 'Raise',            'blockers:trigger_sla': 'Trigger SLA', 'blockers:resolve': 'Resolve',
  'approvals:request': 'Request',       'approvals:decide': 'Decide',
  'documents:upload': 'Upload',         'documents:delete': 'Delete',
  'messages:send': 'Send',
  'activity_log:read': 'View log',
  'sla:edit': 'Edit SLA',
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
  const [confirmDelete, setConfirmDelete] = useState<Role | null>(null);
  const [search, setSearch] = useState('');
  const [permSearch, setPermSearch] = useState('');
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());

  const { data: roles = [], isLoading } = useQuery<Role[]>({
    queryKey: ['roles'],
    queryFn: () => apiClient.get('/roles').then((r) => r.data),
  });

  const deleteMut = useMutation({
    mutationFn: (id: string) => apiClient.delete(`/roles/${id}`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['roles'] }); setConfirmDelete(null); },
  });

  function openCreate() {
    setEditing(null);
    setForm(EMPTY_FORM);
    setError('');
    setPermSearch('');
    setExpandedGroups(new Set(PERMISSION_GROUPS.map((g) => g.label)));
    setShowModal(true);
  }

  function openEdit(role: Role) {
    setEditing(role);
    setForm({ name: role.name, permissions: [...role.permissions] });
    setError('');
    setPermSearch('');
    setExpandedGroups(new Set(PERMISSION_GROUPS.map((g) => g.label)));
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

  function toggleGroup(groupSlugs: string[], allChecked: boolean) {
    setForm((prev) => ({
      ...prev,
      permissions: allChecked
        ? prev.permissions.filter((p) => !groupSlugs.includes(p))
        : [...new Set([...prev.permissions, ...groupSlugs])],
    }));
  }

  function toggleGroupExpand(label: string) {
    setExpandedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(label)) next.delete(label);
      else next.add(label);
      return next;
    });
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

  const filteredRoles = roles.filter(
    (r) => !search || r.name.toLowerCase().includes(search.toLowerCase()),
  );

  const filteredGroups = PERMISSION_GROUPS.filter(
    (g) =>
      !permSearch ||
      g.label.toLowerCase().includes(permSearch.toLowerCase()) ||
      g.slugs.some(
        (s) =>
          s.includes(permSearch.toLowerCase()) ||
          (SLUG_LABEL[s] ?? '').toLowerCase().includes(permSearch.toLowerCase()),
      ),
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Roles</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Define what each role can access across the system.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search roles…"
              className="border border-slate-300 rounded-lg pl-9 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 w-44"
            />
          </div>
          <button
            onClick={openCreate}
            className="flex items-center gap-2 bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-semibold hover:bg-indigo-700 transition-colors"
          >
            <Plus className="w-4 h-4" /> New Role
          </button>
        </div>
      </div>

      {/* Role cards */}
      {isLoading ? (
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden divide-y divide-slate-100">
          {Array.from({ length: 4 }).map((_, i) => <SkeletonRow key={i} />)}
        </div>
      ) : filteredRoles.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-xl px-6 py-16 text-center">
          <Shield className="w-8 h-8 text-slate-300 mx-auto mb-3" />
          <p className="text-sm text-slate-500">No roles found.</p>
        </div>
      ) : (
        <div className="grid gap-4">
          {filteredRoles.map((role) => {
            const coveredGroups = PERMISSION_GROUPS.filter((g) =>
              g.slugs.some((s) => role.permissions.includes(s)),
            );
            return (
              <div key={role._id} className="bg-white border border-slate-200 rounded-xl p-5 hover:border-indigo-200 transition-colors">
                {/* Role header */}
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-indigo-50 flex items-center justify-center shrink-0">
                      <Shield className="w-5 h-5 text-indigo-600" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-semibold text-slate-900 text-base">{role.name}</span>
                        {role.isSystem && (
                          <span className="text-[10px] px-2 py-0.5 bg-slate-100 text-slate-500 rounded-full font-medium uppercase tracking-wide">
                            system
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-slate-400 mt-0.5">
                        {role.permissions.length} permission{role.permissions.length !== 1 ? 's' : ''} across {coveredGroups.length} categories
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      onClick={() => openEdit(role)}
                      className="flex items-center gap-1.5 text-xs font-medium text-slate-600 hover:text-indigo-700 hover:bg-indigo-50 border border-slate-200 hover:border-indigo-200 px-3 py-1.5 rounded-lg transition-colors"
                    >
                      <Pencil className="w-3.5 h-3.5" /> Edit
                    </button>
                    {!role.isSystem && (
                      <button
                        onClick={() => setConfirmDelete(role)}
                        className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                        title="Delete role"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>

                {/* Permission coverage — grouped chips */}
                {coveredGroups.length > 0 && (
                  <div className="mt-4 space-y-2.5">
                    {coveredGroups.map((group) => {
                      const active = group.slugs.filter((s) => role.permissions.includes(s));
                      return (
                        <div key={group.label} className="flex items-start gap-2">
                          <span className={`shrink-0 inline-flex items-center rounded-md border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${group.color}`}>
                            {group.label}
                          </span>
                          <div className="flex flex-wrap gap-1">
                            {active.map((s) => (
                              <span key={s} className="text-[11px] px-2 py-0.5 bg-slate-100 text-slate-600 rounded-md">
                                {SLUG_LABEL[s] ?? s}
                              </span>
                            ))}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}

                {role.permissions.length === 0 && (
                  <p className="mt-3 text-xs text-slate-400 italic">No permissions assigned yet.</p>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Delete confirmation */}
      {confirmDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6 space-y-4">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center shrink-0">
                <Trash2 className="w-5 h-5 text-red-600" />
              </div>
              <div>
                <h3 className="text-base font-semibold text-slate-900">Delete &ldquo;{confirmDelete.name}&rdquo;?</h3>
                <p className="text-sm text-slate-500 mt-1">
                  This role will be permanently removed. Users with this role will lose their permissions.
                </p>
              </div>
            </div>
            <div className="flex gap-3 pt-1">
              <button onClick={() => setConfirmDelete(null)} className="flex-1 px-4 py-2 text-sm font-medium text-slate-700 border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors">
                Cancel
              </button>
              <button
                onClick={() => deleteMut.mutate(confirmDelete._id)}
                disabled={deleteMut.isPending}
                className="flex-1 px-4 py-2 text-sm font-semibold text-white bg-red-600 rounded-lg hover:bg-red-700 disabled:opacity-50 transition-colors"
              >
                {deleteMut.isPending ? 'Deleting…' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Create / Edit modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/40 pt-12 px-4 overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl mb-8">
            {/* Modal header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
              <div>
                <h2 className="text-lg font-semibold text-slate-900">{editing ? 'Edit Role' : 'New Role'}</h2>
                <p className="text-xs text-slate-400 mt-0.5">{form.permissions.length} permissions selected</p>
              </div>
              <button onClick={() => setShowModal(false)} className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="px-6 py-5 space-y-5">
              {/* Name */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">Role name *</label>
                <input
                  type="text"
                  value={form.name}
                  onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
                  placeholder="e.g. Site Supervisor"
                  disabled={editing?.isSystem}
                  className="w-full border border-slate-300 rounded-lg px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:bg-slate-50 disabled:text-slate-400"
                />
              </div>

              {/* Permissions */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <p className="text-sm font-medium text-slate-700">Permissions</p>
                    <p className="text-xs text-slate-400">Toggle groups or individual permissions below</p>
                  </div>
                  <div className="relative">
                    <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
                    <input
                      type="text"
                      value={permSearch}
                      onChange={(e) => setPermSearch(e.target.value)}
                      placeholder="Search…"
                      className="border border-slate-300 rounded-lg pl-8 pr-3 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500 w-36"
                    />
                  </div>
                </div>

                <div className="space-y-2 max-h-[420px] overflow-y-auto pr-1">
                  {filteredGroups.map((group) => {
                    const groupSlugs = group.slugs.filter(
                      (s) =>
                        !permSearch ||
                        s.includes(permSearch.toLowerCase()) ||
                        (SLUG_LABEL[s] ?? '').toLowerCase().includes(permSearch.toLowerCase()),
                    );
                    const checkedCount = groupSlugs.filter((s) => form.permissions.includes(s)).length;
                    const allChecked = checkedCount === groupSlugs.length;
                    const isExpanded = expandedGroups.has(group.label);

                    return (
                      <div key={group.label} className="border border-slate-200 rounded-xl overflow-hidden">
                        {/* Group header row */}
                        <div className="flex items-center gap-3 px-4 py-3 bg-slate-50 hover:bg-slate-100 transition-colors">
                          <button
                            type="button"
                            onClick={() => toggleGroup(groupSlugs, allChecked)}
                            className="text-indigo-600 shrink-0"
                            title={allChecked ? 'Deselect all' : 'Select all'}
                          >
                            {allChecked ? (
                              <CheckSquare className="w-4 h-4" />
                            ) : checkedCount > 0 ? (
                              <CheckSquare className="w-4 h-4 opacity-50" />
                            ) : (
                              <Square className="w-4 h-4 text-slate-400" />
                            )}
                          </button>
                          <span className={`text-[10px] font-semibold uppercase tracking-wide rounded-md border px-2 py-0.5 ${group.color}`}>
                            {group.label}
                          </span>
                          <span className="text-xs text-slate-400 ml-1">
                            {checkedCount}/{groupSlugs.length}
                          </span>
                          <button
                            type="button"
                            onClick={() => toggleGroupExpand(group.label)}
                            className="ml-auto text-slate-400 hover:text-slate-600"
                          >
                            {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                          </button>
                        </div>

                        {/* Permission checkboxes */}
                        {isExpanded && (
                          <div className="grid grid-cols-2 gap-1.5 p-3 bg-white">
                            {groupSlugs.map((slug) => (
                              <label
                                key={slug}
                                className={`flex items-center gap-2.5 px-3 py-2 rounded-lg border cursor-pointer transition-colors ${
                                  form.permissions.includes(slug)
                                    ? 'border-indigo-300 bg-indigo-50'
                                    : 'border-slate-200 hover:border-indigo-200 hover:bg-indigo-50/50'
                                }`}
                              >
                                <input
                                  type="checkbox"
                                  checked={form.permissions.includes(slug)}
                                  onChange={() => togglePerm(slug)}
                                  className="w-3.5 h-3.5 accent-indigo-600 shrink-0"
                                />
                                <span className="text-xs text-slate-700 leading-tight">
                                  {SLUG_LABEL[slug] ?? slug}
                                </span>
                              </label>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              {error && (
                <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                  {error}
                </p>
              )}
            </div>

            <div className="flex justify-between items-center gap-3 px-6 py-4 border-t border-slate-200">
              <span className="text-xs text-slate-400">{form.permissions.length} permissions selected</span>
              <div className="flex gap-3">
                <button onClick={() => setShowModal(false)} className="px-4 py-2 text-sm text-slate-600 hover:text-slate-900 font-medium">
                  Cancel
                </button>
                <button
                  onClick={handleSave}
                  disabled={saving}
                  className="px-4 py-2 bg-indigo-600 text-white text-sm font-semibold rounded-lg hover:bg-indigo-700 disabled:opacity-50 transition-colors"
                >
                  {saving ? 'Saving…' : editing ? 'Save changes' : 'Create role'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
