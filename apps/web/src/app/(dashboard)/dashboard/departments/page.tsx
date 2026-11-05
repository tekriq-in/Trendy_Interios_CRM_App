'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';
import { Plus, Pencil, X, ChevronDown, ChevronRight, Users, UserMinus, Building2, ToggleLeft, ToggleRight, CheckCircle2 } from 'lucide-react';
import { SkeletonRow } from '@/components/ui/Skeleton';
import { EmptyState } from '@/components/ui/EmptyState';

interface Department { _id: string; name: string; description?: string; order: number; defaultSlaHours: number; isActive: boolean; }
interface Role { _id: string; name: string; }
interface Employee { _id: string; name: string; email: string; isActive: boolean; role: Role | string; department?: Department | string; }

const EMPTY_FORM = { name: '', description: '', order: '', defaultSlaHours: '48' };
type FormState = typeof EMPTY_FORM;

export default function DepartmentsPage() {
  const qc = useQueryClient();
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<Department | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');
  const [expanded, setExpanded] = useState<string | null>(null);
  const [reassigning, setReassigning] = useState<{ employee: Employee; toDeptId: string } | null>(null);
  const [confirmDeactivate, setConfirmDeactivate] = useState<Department | null>(null);
  const [showInactive, setShowInactive] = useState(false);

  const { data: departments = [], isLoading } = useQuery<Department[]>({
    queryKey: ['departments', showInactive],
    queryFn: () =>
      apiClient
        .get(`/departments${showInactive ? '?includeInactive=true' : ''}`)
        .then((r) => r.data),
  });
  const visibleDepartments = departments.filter((department) =>
    showInactive ? !department.isActive : department.isActive,
  );

  const { data: employees = [] } = useQuery<Employee[]>({
    queryKey: ['users'],
    queryFn: () => apiClient.get('/users').then((r) => r.data),
  });

  const reassignMut = useMutation({
    mutationFn: ({ id, deptId }: { id: string; deptId: string | null }) =>
      apiClient.patch(`/users/${id}`, { departmentId: deptId }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['users'] });
      setReassigning(null);
    },
  });

  const deactivateMut = useMutation({
    mutationFn: (id: string) => apiClient.delete(`/departments/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['departments'] }),
  });

  const reactivateMut = useMutation({
    mutationFn: (id: string) => apiClient.patch(`/departments/${id}`, { isActive: true }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['departments'] }),
  });

  function employeesInDept(deptId: string) {
    return employees.filter((e) => {
      if (!e.isActive) return false;
      const d = e.department;
      if (!d) return false;
      return typeof d === 'object' ? d._id === deptId : d === deptId;
    });
  }

  function roleName(r: Role | string | undefined) {
    if (!r) return '—';
    return typeof r === 'object' ? r.name : r;
  }

  function set(key: keyof FormState, value: string) {
    setForm((p) => ({ ...p, [key]: value }));
  }

  function openCreate() {
    setEditing(null);
    const nextOrder = departments.length > 0 ? Math.max(...departments.map((d) => d.order)) + 1 : 1;
    setForm({ name: '', description: '', order: String(nextOrder), defaultSlaHours: '48' });
    setErr('');
    setShowModal(true);
  }

  function openEdit(d: Department) {
    setEditing(d);
    setForm({ name: d.name, description: d.description ?? '', order: String(d.order), defaultSlaHours: String(d.defaultSlaHours) });
    setErr('');
    setShowModal(true);
  }

  async function handleSave() {
    if (!form.name.trim()) { setErr('Department name is required.'); return; }
    if (!form.order || isNaN(Number(form.order))) { setErr('Order must be a number.'); return; }
    setSaving(true); setErr('');
    try {
      const payload = { name: form.name.trim(), description: form.description.trim() || undefined, order: Number(form.order), defaultSlaHours: Number(form.defaultSlaHours) || 48 };
      if (editing) { await apiClient.patch(`/departments/${editing._id}`, payload); }
      else { await apiClient.post('/departments', payload); }
      qc.invalidateQueries({ queryKey: ['departments'] });
      setShowModal(false);
    } catch (e: unknown) {
      setErr((e as { response?: { data?: { message?: string } } })?.response?.data?.message ?? 'Failed to save.');
    } finally { setSaving(false); }
  }

  const inputCls = 'w-full border border-slate-300 rounded-lg px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500';
  const labelCls = 'block text-sm font-medium text-slate-700 mb-1.5';
  const unassigned = employees.filter((e) => !e.department && e.isActive);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Departments</h1>
          <p className="text-sm text-slate-500 mt-0.5">Production stages and their assigned staff.</p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setShowInactive((v) => !v)}
            className={`flex items-center gap-1.5 text-sm font-medium px-3 py-2 rounded-lg border transition-colors ${
              showInactive
                ? 'bg-slate-100 text-slate-700 border-slate-300'
                : 'text-slate-500 border-slate-200 hover:bg-slate-50'
            }`}
          >
            {showInactive ? <ToggleRight className="w-4 h-4 text-indigo-600" /> : <ToggleLeft className="w-4 h-4" />}
            {showInactive ? 'Showing inactive' : 'Show inactive'}
          </button>
          <button onClick={openCreate} className="flex items-center gap-2 bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-semibold hover:bg-indigo-700 transition-colors">
            <Plus className="w-4 h-4" /> New Department
          </button>
        </div>
      </div>

      {isLoading ? (
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          {Array.from({ length: 5 }).map((_, i) => <SkeletonRow key={i} />)}
        </div>
      ) : visibleDepartments.length === 0 ? (
        <div className="bg-white rounded-xl border border-slate-200">
          <EmptyState
            icon={Building2}
            title={showInactive ? 'No inactive departments' : 'No departments yet'}
            description={showInactive
              ? 'There are no inactive departments to show.'
              : 'Departments define the production stages for every project. Create your first department to get started.'}
            action={showInactive ? undefined : { label: 'New Department', onClick: openCreate }}
          />
        </div>
      ) : (
        <div className="space-y-2">
          {visibleDepartments.map((d) => {
            const members = employeesInDept(d._id);
            const isOpen = expanded === d._id;
            return (
              <div key={d._id} className={`border rounded-xl overflow-hidden ${d.isActive ? 'bg-white border-slate-200' : 'bg-slate-50 border-slate-200 opacity-75'}`}>
                {/* Department row */}
                <div className="flex items-center gap-3 px-5 py-4">
                  <button onClick={() => setExpanded(isOpen ? null : d._id)} className="text-slate-400 hover:text-slate-600 transition-colors shrink-0">
                    {isOpen ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                  </button>

                  <span className="w-8 h-8 rounded-lg bg-indigo-50 flex items-center justify-center text-xs font-bold text-indigo-600 shrink-0 font-mono">
                    {String(d.order).padStart(2, '0')}
                  </span>

                  <div className="flex-1 min-w-0">
                    <div className="font-semibold text-slate-900 text-sm">{d.name}</div>
                    {d.description && <div className="text-xs text-slate-400 truncate">{d.description}</div>}
                  </div>

                  <div className="flex items-center gap-4 shrink-0">
                    <div className="flex items-center gap-1.5 text-xs text-slate-500">
                      <Users className="w-3.5 h-3.5" />
                      <span>{members.length} staff</span>
                    </div>
                    <div className="text-xs text-slate-400">SLA: <span className="font-semibold text-slate-600">{d.defaultSlaHours}h</span></div>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${d.isActive ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-400'}`}>
                      {d.isActive ? 'Active' : 'Inactive'}
                    </span>
                    <button
                      onClick={() => openEdit(d)}
                      className="flex items-center gap-1.5 text-xs font-medium text-slate-600 hover:text-indigo-700 hover:bg-indigo-50 border border-slate-200 hover:border-indigo-200 px-3 py-1.5 rounded-lg transition-colors"
                    >
                      <Pencil className="w-3.5 h-3.5" /> Edit
                    </button>
                    {d.isActive ? (
                      <button
                        onClick={() => setConfirmDeactivate(d)}
                        className="text-xs font-medium text-red-600 hover:text-red-700 hover:bg-red-50 border border-red-200 px-3 py-1.5 rounded-lg transition-colors"
                      >
                        Deactivate
                      </button>
                    ) : (
                      <button
                        onClick={() => reactivateMut.mutate(d._id)}
                        disabled={reactivateMut.isPending}
                        className="flex items-center gap-1 text-xs font-medium text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50 border border-emerald-200 px-3 py-1.5 rounded-lg transition-colors disabled:opacity-50"
                      >
                        <CheckCircle2 className="w-3.5 h-3.5" /> Activate
                      </button>
                    )}
                  </div>
                </div>

                {/* Expanded: members */}
                {isOpen && (
                  <div className="border-t border-slate-100 bg-slate-50 px-5 py-4">
                    <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">Staff in {d.name}</div>
                    {members.length === 0 ? (
                      <p className="text-sm text-slate-400">No staff assigned to this department.</p>
                    ) : (
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                        {members.map((emp) => (
                          <div key={emp._id} className="flex items-center justify-between bg-white border border-slate-200 rounded-lg px-3 py-2.5 gap-3">
                            <div className="min-w-0">
                              <div className="text-sm font-medium text-slate-800 truncate">{emp.name}</div>
                              <div className="text-xs text-slate-400 truncate">{roleName(emp.role)}</div>
                            </div>
                            <select
                              defaultValue={d._id}
                              onChange={(e) => reassignMut.mutate({ id: emp._id, deptId: e.target.value })}
                              className="text-xs border border-slate-200 rounded-md px-2 py-1 text-slate-600 bg-white focus:outline-none focus:ring-1 focus:ring-indigo-400 shrink-0"
                            >
                              {departments.map((dept) => (
                                <option key={dept._id} value={dept._id}>{dept.name}</option>
                              ))}
                            </select>
                            <button
                              type="button"
                              onClick={() => reassignMut.mutate({ id: emp._id, deptId: null })}
                              disabled={reassignMut.isPending}
                              aria-label={`Remove ${emp.name} from ${d.name}`}
                              title="Remove from department"
                              className="shrink-0 rounded-md p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600 disabled:opacity-50"
                            >
                              <UserMinus className="h-4 w-4" />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}

          {/* Unassigned employees */}
          {unassigned.length > 0 && (
            <div className="bg-amber-50 border border-amber-200 rounded-xl overflow-hidden">
              <div className="px-5 py-3 flex items-center gap-2">
                <span className="text-xs font-semibold text-amber-700 uppercase tracking-wider">Unassigned staff ({unassigned.length})</span>
              </div>
              <div className="border-t border-amber-200 px-5 py-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                {unassigned.map((emp) => (
                  <div key={emp._id} className="flex items-center justify-between bg-white border border-amber-200 rounded-lg px-3 py-2.5 gap-3">
                    <div className="min-w-0">
                      <div className="text-sm font-medium text-slate-800 truncate">{emp.name}</div>
                      <div className="text-xs text-slate-400 truncate">{roleName(emp.role)}</div>
                    </div>
                    <select
                      defaultValue=""
                      onChange={(e) => { if (e.target.value) reassignMut.mutate({ id: emp._id, deptId: e.target.value }); }}
                      className="text-xs border border-slate-200 rounded-md px-2 py-1 text-slate-600 bg-white focus:outline-none focus:ring-1 focus:ring-indigo-400 shrink-0"
                    >
                      <option value="" disabled>Assign…</option>
                      {departments.map((dept) => (
                        <option key={dept._id} value={dept._id}>{dept.name}</option>
                      ))}
                    </select>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Deactivate confirmation */}
      {confirmDeactivate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6 space-y-4">
            <div>
              <h3 className="text-base font-semibold text-slate-900">Deactivate &ldquo;{confirmDeactivate.name}&rdquo;?</h3>
              <p className="text-sm text-slate-500 mt-1.5">
                This department will be marked inactive. Existing projects will not be affected, but no new projects can be assigned to it.
              </p>
            </div>
            <div className="flex gap-3 pt-1">
              <button
                onClick={() => setConfirmDeactivate(null)}
                className="flex-1 px-4 py-2 text-sm font-medium text-slate-700 border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => { deactivateMut.mutate(confirmDeactivate._id); setConfirmDeactivate(null); }}
                disabled={deactivateMut.isPending}
                className="flex-1 px-4 py-2 text-sm font-semibold text-white bg-red-600 rounded-lg hover:bg-red-700 disabled:opacity-50 transition-colors"
              >
                Yes, Deactivate
              </button>
            </div>
          </div>
        </div>
      )}

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/40 pt-20 px-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
              <h2 className="text-lg font-semibold text-slate-900">{editing ? 'Edit Department' : 'New Department'}</h2>
              <button onClick={() => setShowModal(false)} className="p-1 text-slate-400 hover:text-slate-600 rounded-lg"><X className="w-5 h-5" /></button>
            </div>
            <div className="px-6 py-5 space-y-4">
              <div>
                <label className={labelCls}>Name *</label>
                <input type="text" value={form.name} onChange={(e) => set('name', e.target.value)} placeholder="e.g. Assembly" className={inputCls} />
              </div>
              <div>
                <label className={labelCls}>Description</label>
                <input type="text" value={form.description} onChange={(e) => set('description', e.target.value)} placeholder="Optional" className={inputCls} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className={labelCls}>Stage order *</label>
                  <input type="number" min="1" value={form.order} onChange={(e) => set('order', e.target.value)} className={inputCls} />
                </div>
                <div>
                  <label className={labelCls}>Default SLA (hours)</label>
                  <input type="number" min="1" value={form.defaultSlaHours} onChange={(e) => set('defaultSlaHours', e.target.value)} className={inputCls} />
                </div>
              </div>
              {err && <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{err}</p>}
            </div>
            <div className="flex justify-end gap-3 px-6 py-4 border-t border-slate-200">
              <button onClick={() => setShowModal(false)} className="px-4 py-2 text-sm text-slate-600 font-medium">Cancel</button>
              <button onClick={handleSave} disabled={saving} className="px-4 py-2 bg-indigo-600 text-white text-sm font-semibold rounded-lg hover:bg-indigo-700 disabled:opacity-50 transition-colors">
                {saving ? 'Saving…' : editing ? 'Save changes' : 'Create'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
