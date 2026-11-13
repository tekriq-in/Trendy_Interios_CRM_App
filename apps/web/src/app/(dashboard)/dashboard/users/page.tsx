'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';
import { PERMISSIONS } from '@ti/shared';
import { usePermissions } from '@/lib/usePermissions';
import { UserPlus, Pencil, UserX, UserCheck, X, Users, ShieldAlert } from 'lucide-react';
import { SkeletonRow } from '@/components/ui/Skeleton';
import { EmptyState } from '@/components/ui/EmptyState';

interface Role { _id: string; name: string; }
interface Department { _id: string; name: string; }
interface User {
  _id: string;
  name: string;
  email: string;
  phone?: string;
  createdAt?: string;
  isActive: boolean;
  preferredLanguage: 'en' | 'ta';
  role: Role | string;
  department?: Department | string;
}

const EMPTY_FORM = {
  name: '', email: '', phone: '', password: '',
  roleId: '', departmentId: '', reportsToId: '', preferredLanguage: 'en' as 'en' | 'ta',
};
type FormState = typeof EMPTY_FORM;

function roleName(r: Role | string | undefined): string {
  if (!r) return '—';
  return typeof r === 'object' ? r.name : r;
}
function deptName(d: Department | string | undefined): string {
  if (!d) return '—';
  return typeof d === 'object' ? d.name : d;
}

function initials(name: string) {
  return name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();
}

const AVATAR_COLORS = [
  'bg-indigo-100 text-indigo-700',
  'bg-emerald-100 text-emerald-700',
  'bg-amber-100 text-amber-700',
  'bg-rose-100 text-rose-700',
  'bg-sky-100 text-sky-700',
  'bg-violet-100 text-violet-700',
];

function avatarColor(name: string) {
  let hash = 0;
  for (const c of name) hash = (hash * 31 + c.charCodeAt(0)) & 0xffffffff;
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

export default function UsersPage() {
  const { hasPermission, isLoading: permissionsLoading } = usePermissions();
  const canViewUsers = hasPermission(PERMISSIONS.USERS_READ);
  const canCreateUsers = hasPermission(PERMISSIONS.USERS_CREATE);
  const canEditUsers = hasPermission(PERMISSIONS.USERS_EDIT);
  const canDeleteUsers = hasPermission(PERMISSIONS.USERS_DELETE);
  const qc = useQueryClient();
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<User | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');
  const [fieldErrors, setFieldErrors] = useState<Partial<Record<keyof FormState, string>>>({});
  const [confirmDeactivate, setConfirmDeactivate] = useState<User | null>(null);

  const { data: users = [], isLoading } = useQuery<User[]>({
    queryKey: ['users'],
    queryFn: () => apiClient.get('/users').then((r) => r.data),
    enabled: canViewUsers,
  });
  const sortedUsers = [...users].sort(
    (a, b) => Number(b.isActive) - Number(a.isActive),
  );

  const { data: roles = [] } = useQuery<Role[]>({
    queryKey: ['roles'],
    queryFn: () => apiClient.get('/roles').then((r) => r.data),
    enabled: canCreateUsers || canEditUsers,
  });

  const { data: departments = [] } = useQuery<Department[]>({
    queryKey: ['departments'],
    queryFn: () => apiClient.get('/departments').then((r) => r.data),
    enabled: canCreateUsers || canEditUsers,
  });

  const deactivateMut = useMutation({
    mutationFn: (id: string) => apiClient.delete(`/users/${id}`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['users'] }); setConfirmDeactivate(null); },
  });

  const reactivateMut = useMutation({
    mutationFn: (id: string) => apiClient.patch(`/users/${id}`, { isActive: true }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['users'] }),
  });

  function openCreate() {
    setEditing(null);
    setForm(EMPTY_FORM);
    setErr('');
    setFieldErrors({});
    setShowModal(true);
  }

  function openEdit(u: User) {
    setEditing(u);
    setForm({
      name: u.name,
      email: u.email,
      phone: u.phone ?? '',
      password: '',
      roleId: typeof u.role === 'object' ? u.role._id : (u.role ?? ''),
      departmentId: typeof u.department === 'object' ? (u.department?._id ?? '') : (u.department ?? ''),
      reportsToId: '',
      preferredLanguage: u.preferredLanguage ?? 'en',
    });
    setErr('');
    setFieldErrors({});
    setShowModal(true);
  }

  function set(key: keyof FormState, value: string) {
    setForm((p) => ({ ...p, [key]: value }));
    if (fieldErrors[key]) setFieldErrors((p) => ({ ...p, [key]: undefined }));
  }

  function validateForm(): boolean {
    const errors: Partial<Record<keyof FormState, string>> = {};
    if (!form.name.trim() || form.name.trim().length < 2) {
      errors.name = 'Full name is required (at least 2 characters).';
    }
    const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
    if (!editing) {
      if (!form.email.trim()) {
        errors.email = 'Email is required.';
      } else if (!emailRegex.test(form.email.trim())) {
        errors.email = 'Enter a valid email address (e.g. name@example.com).';
      }
      if (!form.password.trim()) {
        errors.password = 'Password is required for new employees.';
      } else if (form.password.length < 8) {
        errors.password = 'Password must be at least 8 characters.';
      } else if (!/(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/.test(form.password)) {
        errors.password = 'Password must include an uppercase letter, a lowercase letter, and a number.';
      }
    } else {
      if (form.email.trim() && !emailRegex.test(form.email.trim())) {
        errors.email = 'Enter a valid email address (e.g. name@example.com).';
      }
    }
    if (form.phone.trim()) {
      const digits = form.phone.replace(/\D/g, '');
      if (digits.length !== 10) {
        errors.phone = 'Phone number must be exactly 10 digits.';
      }
    }
    if (!form.roleId) {
      errors.roleId = 'Please select a role.';
    }
    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  }

  async function handleSave() {
    if (!validateForm()) return;
    setSaving(true);
    setErr('');
    try {
      if (editing) {
        await apiClient.patch(`/users/${editing._id}`, {
          name: form.name.trim(),
          phone: form.phone.trim() || undefined,
          roleId: form.roleId,
          departmentId: form.departmentId || undefined,
          preferredLanguage: form.preferredLanguage,
        });
      } else {
        await apiClient.post('/users', {
          name: form.name.trim(),
          email: form.email.trim().toLowerCase(),
          phone: form.phone.trim() || undefined,
          password: form.password,
          roleId: form.roleId,
          departmentId: form.departmentId || undefined,
          preferredLanguage: form.preferredLanguage,
        });
      }
      qc.invalidateQueries({ queryKey: ['users'] });
      setShowModal(false);
    } catch (e: unknown) {
      const raw = (e as { response?: { data?: { message?: string | string[] } } })?.response?.data?.message;
      setErr(Array.isArray(raw) ? raw.join(', ') : (raw ?? 'Failed to save. Please try again.'));
    } finally {
      setSaving(false);
    }
  }

  const inputCls = (field?: keyof FormState) =>
    `w-full border rounded-lg px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 ${
      field && fieldErrors[field] ? 'border-red-400 bg-red-50' : 'border-slate-300'
    }`;
  const labelCls = 'block text-sm font-medium text-slate-700 mb-1.5';
  const fieldErr = (field: keyof FormState) =>
    fieldErrors[field] ? <p className="text-xs text-red-500 mt-1">{fieldErrors[field]}</p> : null;

  if (permissionsLoading) {
    return <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">{Array.from({ length: 3 }).map((_, i) => <SkeletonRow key={i} />)}</div>;
  }

  if (!canViewUsers) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Employees</h1>
          <p className="text-sm text-slate-500 mt-0.5">Employee directory</p>
        </div>
        <div role="alert" className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 px-5 py-4">
          <ShieldAlert className="mt-0.5 h-5 w-5 shrink-0 text-amber-700" />
          <div>
            <h2 className="text-sm font-semibold text-amber-900">You don’t have access to employee records</h2>
            <p className="mt-1 text-sm text-amber-800">Your role doesn’t include permission to view the employee directory. Contact an administrator if you need access.</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Employees</h1>
          <p className="text-sm text-slate-500 mt-0.5">Manage staff accounts and role assignments.</p>
        </div>
        {canCreateUsers && <button onClick={openCreate} className="flex items-center gap-2 bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-semibold hover:bg-indigo-700 transition-colors">
          <UserPlus className="w-4 h-4" /> Add Employee
        </button>}
      </div>

      {isLoading ? (
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          {Array.from({ length: 5 }).map((_, i) => <SkeletonRow key={i} />)}
        </div>
      ) : users.length === 0 ? (
        <div className="bg-white rounded-xl border border-slate-200">
          <EmptyState
            icon={Users}
            title="No employees yet"
            description="Add your first employee to start assigning them to projects and departments."
            action={canCreateUsers ? { label: 'Add Employee', onClick: openCreate } : undefined}
          />
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase">Employee</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase">Role</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase">Department</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase">Joined</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase">Status</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {sortedUsers.map((u) => (
                <tr key={u._id} className="hover:bg-slate-50 transition-colors">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <div className={`w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${avatarColor(u.name)}`}>
                        {initials(u.name)}
                      </div>
                      <div className="min-w-0">
                        <div className="font-medium text-slate-800 truncate">{u.name}</div>
                        <div className="text-xs text-slate-400 truncate">{u.email}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-slate-600">{roleName(u.role)}</td>
                  <td className="px-4 py-3 text-slate-600">{deptName(u.department)}</td>
                  <td className="px-4 py-3 text-slate-600 whitespace-nowrap">
                    {u.createdAt
                      ? new Date(u.createdAt).toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata' })
                      : '—'}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${u.isActive ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-400'}`}>
                      {u.isActive ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-2">
                      {canEditUsers && <button
                        onClick={() => openEdit(u)}
                        className="flex items-center gap-1.5 text-xs font-medium text-slate-600 hover:text-indigo-700 hover:bg-indigo-50 border border-slate-200 hover:border-indigo-200 px-3 py-1.5 rounded-lg transition-colors"
                      >
                        <Pencil className="w-3.5 h-3.5" /> Edit
                      </button>}
                      {u.isActive ? (
                        canDeleteUsers && <button
                          onClick={() => setConfirmDeactivate(u)}
                          className="flex items-center gap-1.5 text-xs font-medium text-red-600 hover:text-red-700 hover:bg-red-50 border border-red-200 px-3 py-1.5 rounded-lg transition-colors"
                        >
                          <UserX className="w-3.5 h-3.5" /> Deactivate
                        </button>
                      ) : (
                        canEditUsers && <button
                          onClick={() => reactivateMut.mutate(u._id)}
                          disabled={reactivateMut.isPending}
                          className="flex items-center gap-1.5 text-xs font-medium text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50 border border-emerald-200 px-3 py-1.5 rounded-lg transition-colors disabled:opacity-50"
                        >
                          <UserCheck className="w-3.5 h-3.5" /> Activate
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Deactivate confirmation modal */}
      {canDeleteUsers && confirmDeactivate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6 space-y-4">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center shrink-0">
                <UserX className="w-5 h-5 text-red-600" />
              </div>
              <div>
                <h3 className="text-base font-semibold text-slate-900">Deactivate {confirmDeactivate.name}?</h3>
                <p className="text-sm text-slate-500 mt-1">
                  This employee will no longer be able to log in. You can reactivate them later if needed.
                </p>
              </div>
            </div>
            <div className="flex gap-3 pt-2">
              <button
                onClick={() => setConfirmDeactivate(null)}
                className="flex-1 px-4 py-2 text-sm font-medium text-slate-700 border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => deactivateMut.mutate(confirmDeactivate._id)}
                disabled={deactivateMut.isPending}
                className="flex-1 px-4 py-2 text-sm font-semibold text-white bg-red-600 rounded-lg hover:bg-red-700 disabled:opacity-50 transition-colors"
              >
                {deactivateMut.isPending ? 'Deactivating…' : 'Yes, Deactivate'}
              </button>
            </div>
          </div>
        </div>
      )}

      {showModal && (editing ? canEditUsers : canCreateUsers) && (
        <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/40 pt-16 px-4 overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg mb-8">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
              <h2 className="text-lg font-semibold text-slate-900">{editing ? 'Edit Employee' : 'Add Employee'}</h2>
              <button onClick={() => setShowModal(false)} className="p-1 text-slate-400 hover:text-slate-600 rounded-lg">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="px-6 py-5 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <label className={labelCls}>Full name *</label>
                  <input type="text" value={form.name} onChange={(e) => set('name', e.target.value)} placeholder="Ravi Kumar" className={inputCls('name')} />
                  {fieldErr('name')}
                </div>

                <div className="col-span-2">
                  <label className={labelCls}>Email address *</label>
                  <input type="email" value={form.email} onChange={(e) => set('email', e.target.value)} placeholder="Enter email address" autoComplete="off" disabled={!!editing} className={`${inputCls('email')} disabled:bg-slate-50 disabled:text-slate-400`} />
                  {fieldErr('email')}
                </div>

                {!editing && (
                  <div className="col-span-2">
                    <label className={labelCls}>Password *</label>
                    <input type="password" value={form.password} onChange={(e) => set('password', e.target.value)} placeholder="Enter password" autoComplete="new-password" className={inputCls('password')} />
                    {fieldErr('password')}
                  </div>
                )}

                <div>
                  <label className={labelCls}>Phone</label>
                  <input type="tel" value={form.phone} onChange={(e) => set('phone', e.target.value)} placeholder="+91 98765 43210" className={inputCls('phone')} />
                  {fieldErr('phone')}
                </div>

                <div>
                  <label className={labelCls}>Language</label>
                  <select value={form.preferredLanguage} onChange={(e) => set('preferredLanguage', e.target.value)} className={inputCls()}>
                    <option value="en">English</option>
                    <option value="ta">Tamil</option>
                  </select>
                </div>

                <div>
                  <label className={labelCls}>Role *</label>
                  <select value={form.roleId} onChange={(e) => set('roleId', e.target.value)} className={inputCls('roleId')}>
                    <option value="">Select role…</option>
                    {roles.map((r) => <option key={r._id} value={r._id}>{r.name}</option>)}
                  </select>
                  {fieldErr('roleId')}
                </div>

                <div>
                  <label className={labelCls}>Department</label>
                  <select value={form.departmentId} onChange={(e) => set('departmentId', e.target.value)} className={inputCls()}>
                    <option value="">None</option>
                    {departments.map((d) => <option key={d._id} value={d._id}>{d.name}</option>)}
                  </select>
                </div>
              </div>

              {err && <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{err}</p>}
            </div>

            <div className="flex justify-end gap-3 px-6 py-4 border-t border-slate-200">
              <button onClick={() => setShowModal(false)} className="px-4 py-2 text-sm text-slate-600 hover:text-slate-900 font-medium">Cancel</button>
              <button onClick={handleSave} disabled={saving} className="px-4 py-2 bg-indigo-600 text-white text-sm font-semibold rounded-lg hover:bg-indigo-700 disabled:opacity-50 transition-colors">
                {saving ? 'Saving…' : editing ? 'Save changes' : 'Add employee'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
