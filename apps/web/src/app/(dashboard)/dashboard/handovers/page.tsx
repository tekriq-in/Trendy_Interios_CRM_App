'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';
import { CheckCircle, XCircle, ChevronRight, ArrowRight, Plus, X, ExternalLink, PackageCheck, FileText } from 'lucide-react';
import { SkeletonRow } from '@/components/ui/Skeleton';
import { EmptyState } from '@/components/ui/EmptyState';
import { FileUpload, UploadedFile } from '@/components/ui/FileUpload';

interface NameObj { name: string; }
interface ProofFile { _id: string; fileName: string; driveLink: string; mimeType: string; }
interface Handover {
  _id: string;
  status: 'draft' | 'confirmed' | 'accepted' | 'rejected';
  project?: NameObj | string;
  fromDepartment?: NameObj | string;
  toDepartment?: NameObj | string;
  raisedBy?: NameObj | string;
  notes?: string;
  rejectionReason?: string;
  proofFiles?: ProofFile[];
  createdAt?: string;
}
interface Dept { _id: string; name: string; order: number; }
interface Project { _id: string; title: string; currentStage?: { _id: string } | string; }
interface RaiseForm {
  projectId: string; fromDeptId: string; toDeptId: string; notes: string;
}
const EMPTY_RAISE: RaiseForm = { projectId: '', fromDeptId: '', toDeptId: '', notes: '' };

const STATUS_STYLE: Record<string, string> = {
  draft:     'bg-slate-100 text-slate-600',
  confirmed: 'bg-amber-50 text-amber-700',
  accepted:  'bg-emerald-50 text-emerald-700',
  rejected:  'bg-red-50 text-red-600',
};

const STATUS_LABEL: Record<string, string> = {
  draft:     'Waiting for confirmation',
  confirmed: 'Ready to accept',
  accepted:  'Completed',
  rejected:  'Rejected',
};

function nameOf(v: NameObj | string | undefined) {
  if (!v) return '—';
  return typeof v === 'object' ? v.name : v;
}

export default function HandoversPage() {
  const qc = useQueryClient();
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [showRaise, setShowRaise] = useState(false);
  const [raiseForm, setRaiseForm] = useState<RaiseForm>(EMPTY_RAISE);
  const [proofFiles, setProofFiles] = useState<UploadedFile[]>([]);
  const [raiseErr, setRaiseErr] = useState('');

  const { data: handovers = [], isLoading } = useQuery<Handover[]>({
    queryKey: ['handovers'],
    queryFn: () => apiClient.get('/handovers').then((r) => r.data),
  });

  const { data: projects = [] } = useQuery<Project[]>({
    queryKey: ['projects'],
    queryFn: () => apiClient.get('/projects').then((r) => r.data),
    enabled: showRaise,
  });

  const { data: departments = [] } = useQuery<Dept[]>({
    queryKey: ['departments'],
    queryFn: () => apiClient.get('/departments').then((r) => r.data),
    enabled: showRaise,
  });

  const sortedDepts = [...departments].sort((a, b) => a.order - b.order);

  const raiseMut = useMutation({
    mutationFn: async (form: RaiseForm) => {
      if (proofFiles.length === 0) throw new Error('At least one proof file is required');
      return apiClient.post('/handovers', {
        projectId: form.projectId,
        fromDepartmentId: form.fromDeptId,
        toDepartmentId: form.toDeptId,
        proofFileIds: proofFiles.map((f) => f._id),
        notes: form.notes || undefined,
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['handovers'] });
      setShowRaise(false);
      setRaiseForm(EMPTY_RAISE);
      setProofFiles([]);
      setRaiseErr('');
    },
    onError: (e: unknown) => {
      setRaiseErr((e as { response?: { data?: { message?: string } } })?.response?.data?.message ?? String(e));
    },
  });

  const confirmMut = useMutation({
    mutationFn: (id: string) => apiClient.patch(`/handovers/${id}/confirm`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['handovers'] }),
  });

  const acceptMut = useMutation({
    mutationFn: (id: string) => apiClient.patch(`/handovers/${id}/accept`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['handovers'] }),
  });

  const rejectMut = useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) =>
      apiClient.patch(`/handovers/${id}/reject`, { reason }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['handovers'] });
      setRejectingId(null);
      setRejectReason('');
    },
  });

  const pending = handovers.filter((h) => h.status === 'draft' || h.status === 'confirmed');
  const done = handovers.filter((h) => h.status === 'accepted' || h.status === 'rejected');

  function renderHandover(h: Handover) {
    return (
      <div key={h._id} className="bg-white border border-slate-200 rounded-xl p-4 space-y-3">
        {/* Top row */}
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="font-semibold text-slate-900 text-sm">{nameOf(h.project)}</div>
            <div className="flex items-center gap-1.5 mt-1 text-sm text-slate-500">
              <span>{nameOf(h.fromDepartment)}</span>
              <ArrowRight className="w-3.5 h-3.5 text-slate-400" />
              <span className="font-medium text-slate-700">{nameOf(h.toDepartment)}</span>
            </div>
            {h.notes && <div className="text-xs text-slate-400 mt-1 italic">"{h.notes}"</div>}
            {h.rejectionReason && <div className="text-xs text-red-500 mt-1">Rejected: {h.rejectionReason}</div>}
            {(h.proofFiles ?? []).length > 0 && (
              <div className="flex flex-wrap gap-1.5 mt-2">
                {(h.proofFiles ?? []).map((f) => (
                  <a
                    key={f._id}
                    href={f.driveLink}
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center gap-1 text-xs bg-slate-100 hover:bg-indigo-50 text-slate-600 hover:text-indigo-700 px-2 py-1 rounded-md border border-slate-200 transition-colors"
                  >
                    <FileText className="w-3 h-3" />
                    {(f.fileName ?? '').length > 20 ? (f.fileName ?? '').slice(0, 20) + '…' : (f.fileName ?? 'file')}
                    <ExternalLink className="w-2.5 h-2.5 ml-0.5" />
                  </a>
                ))}
              </div>
            )}
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <span className={`text-xs px-2.5 py-1 rounded-full font-semibold ${STATUS_STYLE[h.status]}`}>
              {STATUS_LABEL[h.status] ?? h.status}
            </span>
          </div>
        </div>

        {/* Actions */}
        {h.status === 'draft' && (
          <div className="flex gap-2 pt-1">
            <button
              onClick={() => confirmMut.mutate(h._id)}
              disabled={confirmMut.isPending}
              className="flex items-center gap-1.5 text-sm font-semibold bg-amber-500 text-white px-4 py-2 rounded-lg hover:bg-amber-600 disabled:opacity-50 transition-colors shadow-sm"
            >
              <ChevronRight className="w-4 h-4" /> Confirm Handover
            </button>
          </div>
        )}

        {h.status === 'confirmed' && (
          <div className="flex flex-wrap gap-2 pt-1">
            <button
              onClick={() => acceptMut.mutate(h._id)}
              disabled={acceptMut.isPending}
              className="flex items-center gap-1.5 text-sm font-semibold bg-emerald-600 text-white px-4 py-2 rounded-lg hover:bg-emerald-700 disabled:opacity-50 transition-colors shadow-sm"
            >
              <CheckCircle className="w-4 h-4" /> Accept &amp; Move Stage
            </button>
            <button
              onClick={() => { setRejectingId(h._id); setRejectReason(''); }}
              className="flex items-center gap-1.5 text-sm font-semibold bg-white text-red-600 border border-red-300 px-4 py-2 rounded-lg hover:bg-red-50 transition-colors"
            >
              <XCircle className="w-4 h-4" /> Reject
            </button>
          </div>
        )}

        {/* Inline reject form */}
        {rejectingId === h._id && (
          <div className="flex gap-2 pt-1">
            <input
              type="text"
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              placeholder="Reason for rejection…"
              className="flex-1 border border-slate-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-red-400"
            />
            <button
              onClick={() => rejectMut.mutate({ id: h._id, reason: rejectReason })}
              disabled={!rejectReason.trim() || rejectMut.isPending}
              className="text-xs font-semibold bg-red-600 text-white px-3 py-1.5 rounded-lg hover:bg-red-700 disabled:opacity-50 transition-colors"
            >
              {rejectMut.isPending ? '…' : 'Submit'}
            </button>
            <button onClick={() => setRejectingId(null)} className="text-xs text-slate-400 hover:text-slate-600 px-2">
              Cancel
            </button>
          </div>
        )}
      </div>
    );
  }

  const inputCls = 'w-full border border-slate-300 rounded-lg px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500';
  const labelCls = 'block text-sm font-medium text-slate-700 mb-1.5';

  return (
    <div className="space-y-8">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Handovers</h1>
          <p className="text-sm text-slate-500 mt-0.5">Raise handovers from web or mobile — confirm and accept them here.</p>
        </div>
        <button
          onClick={() => { setShowRaise(true); setRaiseForm(EMPTY_RAISE); setProofFiles([]); setRaiseErr(''); }}
          className="flex items-center gap-2 bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-semibold hover:bg-indigo-700 transition-colors"
        >
          <Plus className="w-4 h-4" /> Raise Handover
        </button>
      </div>

      {/* Raise Handover Modal */}
      {showRaise && (
        <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/40 pt-12 px-4 overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg mb-8">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
              <h2 className="text-lg font-semibold text-slate-900">Raise Handover</h2>
              <button onClick={() => setShowRaise(false)} className="p-1 text-slate-400 hover:text-slate-600 rounded-lg"><X className="w-5 h-5" /></button>
            </div>
            <div className="px-6 py-5 space-y-4 max-h-[70vh] overflow-y-auto">
              <div>
                <label className={labelCls}>Project *</label>
                <select value={raiseForm.projectId} onChange={e => setRaiseForm(p => ({ ...p, projectId: e.target.value }))} className={inputCls}>
                  <option value="">Select project…</option>
                  {projects.map(p => <option key={p._id} value={p._id}>{p.title}</option>)}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className={labelCls}>From department *</label>
                  <select value={raiseForm.fromDeptId} onChange={e => setRaiseForm(p => ({ ...p, fromDeptId: e.target.value }))} className={inputCls}>
                    <option value="">Select…</option>
                    {sortedDepts.map(d => <option key={d._id} value={d._id}>{d.order}. {d.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className={labelCls}>To department *</label>
                  <select value={raiseForm.toDeptId} onChange={e => setRaiseForm(p => ({ ...p, toDeptId: e.target.value }))} className={inputCls}>
                    <option value="">Select…</option>
                    {sortedDepts.map(d => <option key={d._id} value={d._id}>{d.order}. {d.name}</option>)}
                  </select>
                </div>
              </div>
              <FileUpload
                projectId={raiseForm.projectId || undefined}
                type="photo"
                accept="image/*,.pdf"
                multiple
                label="Proof files"
                required
                onUploaded={setProofFiles}
              />
              <div>
                <label className={labelCls}>Notes</label>
                <textarea value={raiseForm.notes} onChange={e => setRaiseForm(p => ({ ...p, notes: e.target.value }))} rows={2} placeholder="Any handover notes…" className={`${inputCls} resize-none`} />
              </div>
              {raiseErr && <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{raiseErr}</p>}
            </div>
            <div className="flex justify-end gap-3 px-6 py-4 border-t border-slate-200">
              <button onClick={() => setShowRaise(false)} className="px-4 py-2 text-sm text-slate-600 font-medium">Cancel</button>
              <button
                onClick={() => raiseMut.mutate(raiseForm)}
                disabled={!raiseForm.projectId || !raiseForm.fromDeptId || !raiseForm.toDeptId || proofFiles.length === 0 || raiseMut.isPending}
                className="px-4 py-2 bg-indigo-600 text-white text-sm font-semibold rounded-lg hover:bg-indigo-700 disabled:opacity-50 transition-colors"
              >
                {raiseMut.isPending ? 'Raising…' : 'Raise Handover'}
              </button>
            </div>
          </div>
        </div>
      )}

      {isLoading ? (
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          {Array.from({ length: 3 }).map((_, i) => <SkeletonRow key={i} />)}
        </div>
      ) : handovers.length === 0 ? (
        <div className="bg-white rounded-xl border border-slate-200">
          <EmptyState
            icon={PackageCheck}
            title="No handovers yet"
            description="Raise a handover when a project is ready to move from one department to the next. A proof photo is required."
            action={{ label: 'Raise Handover', onClick: () => { setShowRaise(true); setRaiseForm(EMPTY_RAISE); setProofFiles([]); setRaiseErr(''); } }}
          />
        </div>
      ) : (
        <>
          {/* Pending */}
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-semibold text-slate-700 uppercase tracking-wider">Needs Action</h2>
              {pending.length > 0 && (
                <span className="w-5 h-5 rounded-full bg-amber-500 text-white text-xs font-bold flex items-center justify-center">{pending.length}</span>
              )}
            </div>
            {pending.length === 0 ? (
              <p className="text-sm text-slate-400 bg-slate-50 rounded-xl px-4 py-6 text-center">All handovers are up to date.</p>
            ) : (
              <div className="space-y-3">{pending.map(renderHandover)}</div>
            )}
          </div>

          {/* Completed */}
          {done.length > 0 && (
            <div className="space-y-3">
              <h2 className="text-sm font-semibold text-slate-700 uppercase tracking-wider">Completed</h2>
              <div className="space-y-3 opacity-70">{done.map(renderHandover)}</div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
