'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';
import { Plus, Pencil, X } from 'lucide-react';

interface Department {
  _id: string;
  name: string;
  description?: string;
  order: number;
  defaultSlaHours: number;
  isActive: boolean;
}

const EMPTY_FORM = { name: '', description: '', order: '', defaultSlaHours: '48' };
type FormState = typeof EMPTY_FORM;

export default function DepartmentsPage() {
  const qc = useQueryClient();
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<Department | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');

  const { data: departments = [], isLoading } = useQuery<Department[]>({
    queryKey: ['departments'],
    queryFn: () => apiClient.get('/departments').then((r) => r.data),
  });

  const deactivateMut = useMutation({
    mutationFn: (id: string) => apiClient.delete(`/departments/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['departments'] }),
  });

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
    setSaving(true);
    setErr('');
    try {
      const payload = {
        name: form.name.trim(),
        description: form.description.trim() || undefined,
        order: Number(form.order),
        defaultSlaHours: Number(form.defaultSlaHours) || 48,
      };
      if (editing) {
        await apiClient.patch(`/departments/${editing._id}`, payload);
      } else {
        await apiClient.post('/departments', payload);
      }
      qc.invalidateQueries({ queryKey: ['departments'] });
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
          <h1 className="text-2xl font-bold text-slate-900">Departments</h1>
          <p className="text-sm text-slate-500 mt-0.5">The 8 production stages of every project, in order.</p>
        </div>
        <button onClick={openCreate} className="flex items-center gap-2 bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-semibold hover:bg-indigo-700 transition-colors">
          <Plus className="w-4 h-4" /> New Department
        </button>
      </div>

      {isLoading ? (
        <p className="text-sm text-slate-400">Loading…</p>
      ) : (
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase w-12">Order</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase">Department</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase">Description</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase">Default SLA</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase">Status</th>
                <th className="px-4 py-3 w-20"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {departments.map((d) => (
                <tr key={d._id} className="hover:bg-slate-50 transition-colors">
                  <td className="px-4 py-3 text-slate-400 font-mono text-xs font-semibold">{String(d.order).padStart(2, '0')}</td>
                  <td className="px-4 py-3 font-medium text-slate-800">{d.name}</td>
                  <td className="px-4 py-3 text-slate-500">{d.description ?? '—'}</td>
                  <td className="px-4 py-3 text-slate-600">
                    <span className="font-semibold">{d.defaultSlaHours}</span>
                    <span className="text-slate-400 ml-1">h</span>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${d.isActive ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-400'}`}>
                      {d.isActive ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-1">
                      <button onClick={() => openEdit(d)} className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors" title="Edit">
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                      {d.isActive && (
                        <button
                          onClick={() => { if (confirm(`Deactivate "${d.name}"?`)) deactivateMut.mutate(d._id); }}
                          className="px-2 py-1 text-xs text-red-500 hover:text-red-700 hover:bg-red-50 rounded-lg transition-colors font-medium"
                          title="Deactivate"
                        >
                          Deactivate
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
              {departments.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-10 text-center text-slate-400 text-sm">No departments found.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/40 pt-20 px-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
              <h2 className="text-lg font-semibold text-slate-900">{editing ? 'Edit Department' : 'New Department'}</h2>
              <button onClick={() => setShowModal(false)} className="p-1 text-slate-400 hover:text-slate-600 rounded-lg">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="px-6 py-5 space-y-4">
              <div>
                <label className={labelCls}>Department name *</label>
                <input type="text" value={form.name} onChange={(e) => set('name', e.target.value)} placeholder="e.g. Assembly" className={inputCls} />
              </div>

              <div>
                <label className={labelCls}>Description</label>
                <input type="text" value={form.description} onChange={(e) => set('description', e.target.value)} placeholder="Optional description" className={inputCls} />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className={labelCls}>Stage order *</label>
                  <input type="number" min="1" value={form.order} onChange={(e) => set('order', e.target.value)} placeholder="e.g. 9" className={inputCls} />
                </div>
                <div>
                  <label className={labelCls}>Default SLA (hours)</label>
                  <input type="number" min="1" value={form.defaultSlaHours} onChange={(e) => set('defaultSlaHours', e.target.value)} className={inputCls} />
                </div>
              </div>

              {err && <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{err}</p>}
            </div>

            <div className="flex justify-end gap-3 px-6 py-4 border-t border-slate-200">
              <button onClick={() => setShowModal(false)} className="px-4 py-2 text-sm text-slate-600 hover:text-slate-900 font-medium">Cancel</button>
              <button onClick={handleSave} disabled={saving} className="px-4 py-2 bg-indigo-600 text-white text-sm font-semibold rounded-lg hover:bg-indigo-700 disabled:opacity-50 transition-colors">
                {saving ? 'Saving…' : editing ? 'Save changes' : 'Create department'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
