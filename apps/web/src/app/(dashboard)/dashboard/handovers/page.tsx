'use client';

import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';

interface RaiseForm {
  projectId: string;
  fromDepartment: string;
  toDepartment: string;
  proofFileIds: string;
  notes: string;
}

interface ActionForm {
  handoverId: string;
  rejectionReason: string;
}

const EMPTY_RAISE: RaiseForm = {
  projectId: '',
  fromDepartment: '',
  toDepartment: '',
  proofFileIds: '',
  notes: '',
};

export default function HandoversPage() {
  const qc = useQueryClient();
  const [raiseForm, setRaiseForm] = useState<RaiseForm>(EMPTY_RAISE);
  const [actionForm, setActionForm] = useState<ActionForm>({ handoverId: '', rejectionReason: '' });
  const [activeTab, setActiveTab] = useState<'raise' | 'action'>('raise');
  const [successMsg, setSuccessMsg] = useState('');

  const raise = useMutation({
    mutationFn: (data: RaiseForm) =>
      apiClient.post('/handovers', {
        project: data.projectId,
        fromDepartment: data.fromDepartment,
        toDepartment: data.toDepartment,
        proofFileIds: data.proofFileIds.split(',').map((s) => s.trim()).filter(Boolean),
        notes: data.notes,
      }),
    onSuccess: () => {
      setRaiseForm(EMPTY_RAISE);
      setSuccessMsg('Handover raised successfully.');
      setTimeout(() => setSuccessMsg(''), 3000);
    },
  });

  const confirm = useMutation({
    mutationFn: (id: string) => apiClient.patch(`/handovers/${id}/confirm`),
    onSuccess: () => setSuccessMsg('Handover confirmed.'),
  });

  const accept = useMutation({
    mutationFn: (id: string) => apiClient.patch(`/handovers/${id}/accept`),
    onSuccess: () => setSuccessMsg('Handover accepted.'),
  });

  const reject = useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) =>
      apiClient.patch(`/handovers/${id}/reject`, { rejectionReason: reason }),
    onSuccess: () => {
      setActionForm({ handoverId: '', rejectionReason: '' });
      setSuccessMsg('Handover rejected.');
    },
  });

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">Handovers</h1>

      {successMsg && (
        <div className="bg-green-50 border border-green-200 text-green-800 px-4 py-2 rounded text-sm">
          {successMsg}
        </div>
      )}

      <div className="flex gap-2 border-b border-gray-200">
        {(['raise', 'action'] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`pb-2 px-1 text-sm font-medium border-b-2 -mb-px ${
              activeTab === tab
                ? 'border-blue-600 text-blue-700'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            {tab === 'raise' ? 'Raise Handover' : 'Confirm / Accept / Reject'}
          </button>
        ))}
      </div>

      {activeTab === 'raise' && (
        <div className="bg-white border border-gray-200 rounded-lg p-5 space-y-4 max-w-lg">
          <p className="text-xs text-gray-500">
            Upload proof documents first via the Documents endpoint, then paste their IDs below.
          </p>
          <div className="space-y-3">
            <input
              className="w-full border border-gray-300 rounded px-3 py-1.5 text-sm"
              placeholder="Project ID"
              value={raiseForm.projectId}
              onChange={(e) => setRaiseForm({ ...raiseForm, projectId: e.target.value })}
            />
            <input
              className="w-full border border-gray-300 rounded px-3 py-1.5 text-sm"
              placeholder="From Department ID"
              value={raiseForm.fromDepartment}
              onChange={(e) => setRaiseForm({ ...raiseForm, fromDepartment: e.target.value })}
            />
            <input
              className="w-full border border-gray-300 rounded px-3 py-1.5 text-sm"
              placeholder="To Department ID"
              value={raiseForm.toDepartment}
              onChange={(e) => setRaiseForm({ ...raiseForm, toDepartment: e.target.value })}
            />
            <input
              className="w-full border border-gray-300 rounded px-3 py-1.5 text-sm"
              placeholder="Proof File IDs (comma-separated, min 1 required)"
              value={raiseForm.proofFileIds}
              onChange={(e) => setRaiseForm({ ...raiseForm, proofFileIds: e.target.value })}
            />
            <textarea
              className="w-full border border-gray-300 rounded px-3 py-1.5 text-sm"
              placeholder="Notes (optional)"
              rows={2}
              value={raiseForm.notes}
              onChange={(e) => setRaiseForm({ ...raiseForm, notes: e.target.value })}
            />
          </div>
          <button
            onClick={() => raise.mutate(raiseForm)}
            disabled={
              raise.isPending ||
              !raiseForm.projectId ||
              !raiseForm.fromDepartment ||
              !raiseForm.toDepartment ||
              !raiseForm.proofFileIds.trim()
            }
            className="text-sm bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 disabled:opacity-50"
          >
            {raise.isPending ? 'Raising…' : 'Raise Handover'}
          </button>
          {raise.isError && (
            <p className="text-xs text-red-600">Failed — check all IDs and ensure at least one proof file.</p>
          )}
        </div>
      )}

      {activeTab === 'action' && (
        <div className="bg-white border border-gray-200 rounded-lg p-5 space-y-4 max-w-lg">
          <p className="text-xs text-gray-500">
            Enter a Handover ID to confirm, accept, or reject it. Find IDs from the API or project detail page.
          </p>
          <input
            className="w-full border border-gray-300 rounded px-3 py-1.5 text-sm"
            placeholder="Handover ID"
            value={actionForm.handoverId}
            onChange={(e) => setActionForm({ ...actionForm, handoverId: e.target.value })}
          />
          <div className="flex gap-2">
            <button
              onClick={() => confirm.mutate(actionForm.handoverId)}
              disabled={confirm.isPending || !actionForm.handoverId}
              className="text-sm bg-blue-600 text-white px-3 py-1.5 rounded hover:bg-blue-700 disabled:opacity-50"
            >
              Confirm
            </button>
            <button
              onClick={() => accept.mutate(actionForm.handoverId)}
              disabled={accept.isPending || !actionForm.handoverId}
              className="text-sm bg-green-600 text-white px-3 py-1.5 rounded hover:bg-green-700 disabled:opacity-50"
            >
              Accept
            </button>
          </div>
          <div className="border-t border-gray-100 pt-3 space-y-2">
            <input
              className="w-full border border-gray-300 rounded px-3 py-1.5 text-sm"
              placeholder="Rejection reason (required to reject)"
              value={actionForm.rejectionReason}
              onChange={(e) => setActionForm({ ...actionForm, rejectionReason: e.target.value })}
            />
            <button
              onClick={() =>
                reject.mutate({ id: actionForm.handoverId, reason: actionForm.rejectionReason })
              }
              disabled={reject.isPending || !actionForm.handoverId || !actionForm.rejectionReason}
              className="text-sm bg-red-600 text-white px-3 py-1.5 rounded hover:bg-red-700 disabled:opacity-50"
            >
              Reject
            </button>
          </div>
          {(confirm.isError || accept.isError || reject.isError) && (
            <p className="text-xs text-red-600">Action failed — check the handover ID and status.</p>
          )}
        </div>
      )}
    </div>
  );
}
