'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';
import { CheckCircle, XCircle, ChevronRight, ArrowRight } from 'lucide-react';

interface NameObj { name: string; }
interface Handover {
  _id: string;
  status: 'draft' | 'confirmed' | 'accepted' | 'rejected';
  project?: NameObj | string;
  fromDepartment?: NameObj | string;
  toDepartment?: NameObj | string;
  raisedBy?: NameObj | string;
  notes?: string;
  rejectionReason?: string;
  createdAt?: string;
}

const STATUS_STYLE: Record<string, string> = {
  draft:     'bg-slate-100 text-slate-600',
  confirmed: 'bg-amber-50 text-amber-700',
  accepted:  'bg-emerald-50 text-emerald-700',
  rejected:  'bg-red-50 text-red-600',
};

function nameOf(v: NameObj | string | undefined) {
  if (!v) return '—';
  return typeof v === 'object' ? v.name : v;
}

export default function HandoversPage() {
  const qc = useQueryClient();
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState('');

  const { data: handovers = [], isLoading } = useQuery<Handover[]>({
    queryKey: ['handovers'],
    queryFn: () => apiClient.get('/handovers').then((r) => r.data),
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
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <span className={`text-xs px-2.5 py-1 rounded-full font-semibold ${STATUS_STYLE[h.status]}`}>
              {h.status}
            </span>
          </div>
        </div>

        {/* Actions */}
        {h.status === 'draft' && (
          <div className="flex gap-2 pt-1">
            <button
              onClick={() => confirmMut.mutate(h._id)}
              disabled={confirmMut.isPending}
              className="flex items-center gap-1.5 text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200 px-3 py-1.5 rounded-lg hover:bg-amber-100 disabled:opacity-50 transition-colors"
            >
              <ChevronRight className="w-3.5 h-3.5" /> Confirm
            </button>
          </div>
        )}

        {h.status === 'confirmed' && (
          <div className="flex flex-wrap gap-2 pt-1">
            <button
              onClick={() => acceptMut.mutate(h._id)}
              disabled={acceptMut.isPending}
              className="flex items-center gap-1.5 text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200 px-3 py-1.5 rounded-lg hover:bg-emerald-100 disabled:opacity-50 transition-colors"
            >
              <CheckCircle className="w-3.5 h-3.5" /> Accept
            </button>
            <button
              onClick={() => { setRejectingId(h._id); setRejectReason(''); }}
              className="flex items-center gap-1.5 text-xs font-semibold bg-red-50 text-red-600 border border-red-200 px-3 py-1.5 rounded-lg hover:bg-red-100 transition-colors"
            >
              <XCircle className="w-3.5 h-3.5" /> Reject
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

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Handovers</h1>
        <p className="text-sm text-slate-500 mt-0.5">Staff raise handovers from the mobile app — confirm and accept them here.</p>
      </div>

      {isLoading ? (
        <p className="text-sm text-slate-400">Loading…</p>
      ) : (
        <>
          {/* Pending */}
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-semibold text-slate-700 uppercase tracking-wider">Pending</h2>
              {pending.length > 0 && (
                <span className="w-5 h-5 rounded-full bg-amber-500 text-white text-xs font-bold flex items-center justify-center">{pending.length}</span>
              )}
            </div>
            {pending.length === 0 ? (
              <p className="text-sm text-slate-400 bg-slate-50 rounded-xl px-4 py-6 text-center">No pending handovers.</p>
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
