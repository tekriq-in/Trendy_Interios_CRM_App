'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';
import { useAuthStore } from '@/store/auth.store';
import { Printer, Plus, Pencil, Trash2, Upload, X, Palette } from 'lucide-react';
import { FileUpload } from '@/components/ui/FileUpload';
import type { UploadedFile } from '@/components/ui/FileUpload';
import { AutocompleteInput } from '@/components/ui/AutocompleteInput';
import type { Suggestion } from '@/components/ui/AutocompleteInput';
import { useToast } from '@/components/ui/Toast';

const MATERIAL_TYPES = ['Acrylic', 'LAM', 'Louver', 'Veneer', 'PU', 'Membrane', 'Glass', 'Other'] as const;
type MaterialType = typeof MATERIAL_TYPES[number];

interface ShadeCardEntry {
  _id: string;
  area: string;
  units: string[];
  material: MaterialType;
  codeName: string;
  photoUrl?: string;
  remarks?: string;
  slNo: number;
}

interface EntryForm {
  area: string;
  units: string; // newline-separated in the textarea
  material: MaterialType;
  codeName: string;
  photoUrl: string;
  remarks: string;
}

const EMPTY_FORM: EntryForm = {
  area: '', units: '', material: 'Acrylic', codeName: '', photoUrl: '', remarks: '',
};

const MATERIAL_COLORS: Record<string, string> = {
  Acrylic: 'bg-indigo-50 text-indigo-700',
  LAM: 'bg-amber-50 text-amber-700',
  Louver: 'bg-teal-50 text-teal-700',
  Veneer: 'bg-orange-50 text-orange-700',
  PU: 'bg-purple-50 text-purple-700',
  Membrane: 'bg-pink-50 text-pink-700',
  Glass: 'bg-sky-50 text-sky-700',
  Other: 'bg-slate-50 text-slate-700',
};

export function ShadeCardSection({ projectId, projectTitle, clientName }: {
  projectId: string;
  projectTitle: string;
  clientName?: string;
}) {
  const qc = useQueryClient();
  const { toast } = useToast();
  const user = useAuthStore((s) => s.user);
  const isDesign = user?.department?.name === 'Design' || user?.role === 'MD' || user?.role === 'GM';

  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<ShadeCardEntry | null>(null);
  const [form, setForm] = useState<EntryForm>(EMPTY_FORM);
  const [err, setErr] = useState('');
  const [swatchKey, setSwatchKey] = useState(0); // remount FileUpload to reset it

  const { data: entries = [], isLoading } = useQuery<ShadeCardEntry[]>({
    queryKey: ['shade-card', projectId],
    queryFn: () => apiClient.get(`/projects/${projectId}/shade-card`).then((r) => r.data),
  });

  const saveMut = useMutation({
    mutationFn: (data: Omit<EntryForm, 'units'> & { units: string[] }) =>
      editing
        ? apiClient.patch(`/shade-card/${editing._id}`, data)
        : apiClient.post(`/projects/${projectId}/shade-card`, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['shade-card', projectId] });
      toast('success', editing ? 'Entry updated.' : 'Entry added.');
      closeModal();
    },
    onError: () => setErr('Failed to save entry.'),
  });

  const deleteMut = useMutation({
    mutationFn: (id: string) => apiClient.delete(`/shade-card/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['shade-card', projectId] });
      toast('success', 'Entry deleted.');
    },
    onError: () => toast('error', 'Failed to delete entry.'),
  });

  function openAdd() {
    setEditing(null);
    setForm(EMPTY_FORM);
    setSwatchKey((k) => k + 1);
    setErr('');
    setShowModal(true);
  }

  function openEdit(entry: ShadeCardEntry) {
    setEditing(entry);
    setForm({
      area: entry.area,
      units: entry.units.join('\n'),
      material: entry.material,
      codeName: entry.codeName,
      photoUrl: entry.photoUrl ?? '',
      remarks: entry.remarks ?? '',
    });
    setSwatchKey((k) => k + 1);
    setErr('');
    setShowModal(true);
  }

  function closeModal() {
    setShowModal(false);
    setEditing(null);
    setForm(EMPTY_FORM);
    setErr('');
  }

  function handleSwatchUploaded(files: UploadedFile[]) {
    if (files[0]) {
      setForm((f) => ({ ...f, photoUrl: files[0].driveLink }));
    }
  }

  function handleSave() {
    const units = form.units.split('\n').map((u) => u.trim()).filter(Boolean);
    if (!form.area.trim()) { setErr('Area is required.'); return; }
    if (units.length === 0) { setErr('Enter at least one unit.'); return; }
    if (!form.codeName.trim()) { setErr('Code name is required.'); return; }

    saveMut.mutate({ ...form, units, photoUrl: form.photoUrl });
  }

  // Group entries by area for display
  const grouped = entries.reduce<Record<string, ShadeCardEntry[]>>((acc, e) => {
    (acc[e.area] = acc[e.area] ?? []).push(e);
    return acc;
  }, {});

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-5">
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-2">
          <Palette className="w-4 h-4 text-indigo-500" />
          <h2 className="text-sm font-semibold text-slate-700 uppercase tracking-wider">Shade Card / Material Selection</h2>
        </div>
        <div className="flex items-center gap-2">
          {entries.length > 0 && (
            <a
              href={`/dashboard/projects/${projectId}/shade-card/print`}
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border border-slate-200 text-slate-600 hover:bg-slate-50 transition-colors"
            >
              <Printer className="w-3.5 h-3.5" />
              Generate Sheet
            </a>
          )}
          {isDesign && (
            <button
              onClick={openAdd}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-indigo-600 text-white hover:bg-indigo-700 transition-colors"
            >
              <Plus className="w-3.5 h-3.5" />
              Add Entry
            </button>
          )}
        </div>
      </div>

      {isLoading ? (
        <p className="text-sm text-slate-400 text-center py-6">Loading…</p>
      ) : entries.length === 0 ? (
        <div className="text-center py-8">
          <Palette className="w-10 h-10 text-slate-300 mx-auto mb-3" />
          <p className="text-sm text-slate-400">No shade card entries yet.</p>
          {isDesign && (
            <button onClick={openAdd} className="mt-3 text-xs text-indigo-600 hover:underline">
              Add first entry
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          {Object.entries(grouped).map(([area, areaEntries]) => (
            <div key={area}>
              <div className="flex items-center gap-2 mb-2">
                <span className="text-xs font-semibold uppercase tracking-wider text-slate-500 bg-slate-100 px-2 py-0.5 rounded">{area}</span>
              </div>
              <div className="space-y-2">
                {areaEntries.map((entry) => (
                  <div key={entry._id} className="flex items-start gap-3 p-3 rounded-lg border border-slate-100 bg-slate-50 hover:border-indigo-200 transition-colors group">
                    {/* Swatch photo */}
                    <div className="w-14 h-14 rounded-lg bg-slate-200 overflow-hidden shrink-0">
                      {entry.photoUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={entry.photoUrl} alt={entry.codeName} className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-slate-400">
                          <Upload className="w-5 h-5" />
                        </div>
                      )}
                    </div>

                    {/* Details */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${MATERIAL_COLORS[entry.material]}`}>
                          {entry.material}
                        </span>
                        <span className="text-sm font-semibold text-slate-800">{entry.codeName}</span>
                        {entry.remarks && (
                          <span className="text-xs text-slate-400 italic truncate max-w-[200px]">{entry.remarks}</span>
                        )}
                      </div>
                      <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                        {entry.units.join(' · ')}
                      </p>
                    </div>

                    {/* Sl No + Actions */}
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="text-xs text-slate-400 font-mono">#{entry.slNo}</span>
                      {isDesign && (
                        <>
                          <button onClick={() => openEdit(entry)}
                            className="p-1 rounded text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 opacity-0 group-hover:opacity-100 transition-all">
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => {
                              if (window.confirm(`Delete "${entry.codeName}"?`)) {
                                deleteMut.mutate(entry._id);
                              }
                            }}
                            className="p-1 rounded text-slate-400 hover:text-red-600 hover:bg-red-50 opacity-0 group-hover:opacity-100 transition-all">
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add/Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4"
          onClick={(e) => { if (e.target === e.currentTarget) closeModal(); }}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
              <h3 className="text-base font-semibold text-slate-900">
                {editing ? 'Edit Shade Card Entry' : 'Add Shade Card Entry'}
              </h3>
              <button onClick={closeModal} className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="px-6 py-5 space-y-4">
              {/* Area */}
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">
                  Area / Room <span className="text-red-500">*</span>
                </label>
                <AutocompleteInput
                  value={form.area}
                  onChange={(v) => setForm((f) => ({ ...f, area: v }))}
                  field="area"
                  placeholder="e.g. Kitchen-Ground Floor, Living Room"
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              {/* Units */}
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">
                  Units <span className="text-red-500">*</span>{' '}
                  <span className="text-slate-400">(one per line)</span>
                </label>
                <textarea
                  value={form.units}
                  onChange={(e) => setForm((f) => ({ ...f, units: e.target.value }))}
                  placeholder={"GF_KITCHEN BASE UNIT\nGF_WALL UNIT\nGF_LOFT FILLER"}
                  rows={4}
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 font-mono"
                />
              </div>

              {/* Material + Code name */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">
                    Material <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={form.material}
                    onChange={(e) => setForm((f) => ({ ...f, material: e.target.value as MaterialType }))}
                    className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
                  >
                    {MATERIAL_TYPES.map((m) => (
                      <option key={m} value={m}>{m}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">
                    Code Name / Shade <span className="text-red-500">*</span>
                  </label>
                  <AutocompleteInput
                    value={form.codeName}
                    onChange={(v) => setForm((f) => ({ ...f, codeName: v }))}
                    onSelect={(s: Suggestion) => {
                      if (s.photoUrl) {
                        setForm((f) => ({ ...f, codeName: s.value, photoUrl: s.photoUrl! }));
                        setSwatchKey((k) => k + 1);
                      }
                    }}
                    field="codeName"
                    placeholder="e.g. MYSTIC-MN 889"
                    className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              </div>

              {/* Swatch photo */}
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Swatch Photo</label>
                {form.photoUrl && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={form.photoUrl} alt="current swatch" className="w-20 h-14 object-cover rounded-lg mb-2" />
                )}
                <FileUpload
                  key={swatchKey}
                  accept="image/*"
                  onUploaded={handleSwatchUploaded}
                />
              </div>

              {/* Remarks */}
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Remarks</label>
                <input
                  type="text"
                  value={form.remarks}
                  onChange={(e) => setForm((f) => ({ ...f, remarks: e.target.value }))}
                  placeholder="Optional notes"
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              {err && <p className="text-xs text-red-600">{err}</p>}

              <div className="flex gap-3 pt-2">
                <button onClick={closeModal}
                  className="flex-1 py-2 rounded-lg border border-slate-200 text-sm font-medium text-slate-600 hover:bg-slate-50 transition-colors">
                  Cancel
                </button>
                <button onClick={handleSave} disabled={saveMut.isPending}
                  className="flex-1 py-2 rounded-lg bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-700 disabled:opacity-50 transition-colors">
                  {saveMut.isPending ? 'Saving…' : editing ? 'Update' : 'Add Entry'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
