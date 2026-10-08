'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';
import { UserPlus, Pencil, UserX, X } from 'lucide-react';

interface Role { _id: string; name: string; }
interface Department { _id: string; name: string; }
interface User {
  _id: string;
  name: string;
  email: string;
  phone?: string;
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

export default function UsersPage() {
  const qc = useQueryClient();
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<User | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');

  const { data: users = [], isLoading } = useQuery<User[]>({
    queryKey: ['users'],
    queryFn: () => apiClient.get('/users').then((r) => r.data),
  });

  const { data: roles = [] } = useQuery<Role[]>({
    queryKey: ['roles'],
    queryFn: () => apiClient.get('/roles').then((r) => r.data),
  });

  const { data: departments = [] } = useQuery<Department[]>({
    queryKey: ['departments'],
    queryFn: () => apiClient.get('/departments').then((r) => r.data),
  });

  const deactivateMut = useMutation({
    mutationFn: (id: string) => apiClient.delete(`/users/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['users'] }),
  });

  function set(key: keyof FormState, value: string) {
    setForm((p) => ({ ...p, [key]: value }));
  }

  function openCreate() {
    setEditing(null);
    setForm(EMPTY_FORM);
    setErr('');
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
    setShowModal(true);
  }

  async function handleSave() {
    if (!form.name.trim() || !form.email.trim() || !form.roleId) {
      setErr('Name, email, and role are required.');
      return;
    }
    if (!editing && !form.password.trim()) {
      setErr('Password is required for new employees.');
      return;
    }
    setSaving(true);
    setErr('');
    try {
      if (editing) {
        const payload: Record<string, unknown> = {
          name: form.name,
          phone: form.phone || undefined,
          roleId: form.roleId,
          departmentId: form.departmentId || undefined,
          preferredLanguage: form.preferredLanguage,
        };
        await apiClient.patch(`/users/${editing._id}`, payload);
      } else {
        await apiClient.post('/users', {
          name: form.name,
          email: form.email,
          phone: form.phone || undefined,
          password: form.password,
          roleId: form.roleId,
          departmentId: form.departmentId || undefined,
          preferredLanguage: form.preferredLanguage,
        });
      }
      qc.invalidateQueries({ queryKey: ['users'] });
      setShowModal(false);
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { message?: string } } })?.response?.data?.message;
      setErr(msg ?? 'Failed to save.');
    } finally {
      setSaving(false);
    }
  }

  const inputCls = 'w-full border border-slate-300 rounded-lg px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500';
  const labelCls = 'block text-sm font-medium text-slate-700 mb-1.5';

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Employees</h1>
          <p className="text-sm text-slate-500 mt-0.5">Manage staff accounts and role assignments.</p>
        </div>
        <button onClick={openCreate} className="flex items-center gap-2 bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-semibold hover:bg-indigo-700 transition-colors">
          <UserPlus className="w-4 h-4" /> Add Employee
        </button>
      </div>

      {isLoading ? (
        <p className="text-sm text-slate-400">Loading…</p>
      ) : (
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase">Name</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase">Email</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase">Role</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase">Department</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase">Lang</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase">Status</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {users.map((u) => (
                <tr key={u._id} className="hover:bg-slate-50 transition-colors">
                  <td className="px-4 py-3 font-medium text-slate-800">{u.name}</td>
                  <td className="px-4 py-3 text-slate-500">{u.email}</td>
                  <td className="px-4 py-3 text-slate-600">{roleName(u.role)}</td>
                  <td className="px-4 py-3 text-slate-600">{deptName(u.department)}</td>
                  <td className="px-4 py-3 text-slate-400 uppercase text-xs font-semibold">{u.preferredLanguage}</td>
                  <td className="px-4 py-3">
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${u.isActive ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-400'}`}>
                      {u.isActive ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-1">
                      <button onClick={() => openEdit(u)} className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors" title="Edit">
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                      {u.isActive && (
                        <button
                          onClick={() => { if (confirm(`Deactivate ${u.name}?`)) deactivateMut.mutate(u._id); }}
                          className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                          title="Deactivate"
                        >
                          <UserX className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
              {users.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-4 py-10 text-center text-slate-400 text-sm">No employees found.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {showModal && (
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
                  <label className={labelCls}>Full name</label>
                  <input type="text" value={form.name} onChange={(e) => set('name', e.target.value)} placeholder="Ravi Kumar" className={inputCls} />
                </div>

                <div className="col-span-2">
                  <label className={labelCls}>Email address</label>
                  <input type="email" value={form.email} onChange={(e) => set('email', e.target.value)} placeholder="ravi@trendyinteriors.in" disabled={!!editing} className={`${inputCls} disabled:bg-slate-50 disabled:text-slate-400`} />
                </div>

                {!editing && (
                  <div className="col-span-2">
                    <label className={labelCls}>Password</label>
                    <input type="password" value={form.password} onChange={(e) => set('password', e.target.value)} placeholder="••••••••" className={inputCls} />
                  </div>
                )}

                <div>
                  <label className={labelCls}>Phone</label>
                  <input type="tel" value={form.phone} onChange={(e) => set('phone', e.target.value)} placeholder="+91 98765 43210" className={inputCls} />
                </div>

                <div>
                  <label className={labelCls}>Language</label>
                  <select value={form.preferredLanguage} onChange={(e) => set('preferredLanguage', e.target.value)} className={inputCls}>
                    <option value="en">English</option>
                    <option value="ta">Tamil</option>
                  </select>
                </div>

                <div>
                  <label className={labelCls}>Role *</label>
                  <select value={form.roleId} onChange={(e) => set('roleId', e.target.value)} className={inputCls}>
                    <option value="">Select role…</option>
                    {roles.map((r) => <option key={r._id} value={r._id}>{r.name}</option>)}
                  </select>
                </div>

                <div>
                  <label className={labelCls}>Department</label>
                  <select value={form.departmentId} onChange={(e) => set('departmentId', e.target.value)} className={inputCls}>
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
