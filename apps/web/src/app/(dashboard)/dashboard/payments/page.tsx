'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';
import type { Payment } from '@ti/shared';
import { formatINR } from '@ti/shared';

type PaymentPopulated = Payment & {
  project?: { _id: string; title: string };
  collectedBy?: { name: string };
  followUpSentAt?: string;
};

const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

function canSendFollowUp(followUpSentAt?: string): boolean {
  if (!followUpSentAt) return true;
  return Date.now() - new Date(followUpSentAt).getTime() > SEVEN_DAYS_MS;
}

export default function PaymentsPage() {
  const qc = useQueryClient();

  const [projectId, setProjectId] = useState('');
  const [kind, setKind] = useState<'advance' | 'periodic' | 'final'>('advance');
  const [amount, setAmount] = useState('');
  const [notes, setNotes] = useState('');
  const [paidAt, setPaidAt] = useState('');
  const [formMsg, setFormMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const { data: overdue, isLoading } = useQuery<PaymentPopulated[]>({
    queryKey: ['payments-overdue'],
    queryFn: () => apiClient.get('/payments/overdue').then((r) => r.data),
  });

  const recordMutation = useMutation({
    mutationFn: (body: { kind: string; amount: number; notes?: string; paidAt?: string }) =>
      apiClient.post(`/projects/${projectId}/payments`, body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['payments-overdue'] });
      setProjectId('');
      setAmount('');
      setNotes('');
      setPaidAt('');
      setFormMsg({ type: 'success', text: 'Payment recorded.' });
      setTimeout(() => setFormMsg(null), 3000);
    },
    onError: () => setFormMsg({ type: 'error', text: 'Failed to record payment.' }),
  });

  const followUpMutation = useMutation({
    mutationFn: (id: string) => apiClient.post(`/payments/${id}/follow-up`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['payments-overdue'] }),
  });

  function handleRecord(e: React.FormEvent) {
    e.preventDefault();
    if (!projectId || !amount) return;
    recordMutation.mutate({
      kind,
      amount: parseFloat(amount),
      notes: notes || undefined,
      paidAt: paidAt || undefined,
    });
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 mb-4">Payments</h1>

        {/* Record Payment */}
        <div className="bg-white rounded-lg border border-gray-200 p-5">
          <h2 className="text-sm font-semibold text-gray-700 mb-4">Record Payment</h2>
          <form onSubmit={handleRecord} className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs text-gray-500 mb-1">Project ID *</label>
              <input
                value={projectId}
                onChange={(e) => setProjectId(e.target.value)}
                placeholder="MongoDB ObjectId"
                required
                className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Kind *</label>
              <select
                value={kind}
                onChange={(e) => setKind(e.target.value as typeof kind)}
                className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                <option value="advance">Advance</option>
                <option value="periodic">Periodic</option>
                <option value="final">Final</option>
              </select>
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Amount (INR) *</label>
              <input
                type="number"
                min="0"
                step="0.01"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0.00"
                required
                className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Paid At</label>
              <input
                type="date"
                value={paidAt}
                onChange={(e) => setPaidAt(e.target.value)}
                className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
            <div className="sm:col-span-2">
              <label className="block text-xs text-gray-500 mb-1">Notes</label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={2}
                className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
            <div className="sm:col-span-2 flex items-center gap-4">
              <button
                type="submit"
                disabled={recordMutation.isPending}
                className="bg-indigo-600 text-white px-4 py-2 rounded text-sm hover:bg-indigo-700 disabled:opacity-50"
              >
                {recordMutation.isPending ? 'Saving…' : 'Record Payment'}
              </button>
              {formMsg && (
                <span className={`text-sm ${formMsg.type === 'success' ? 'text-green-600' : 'text-red-600'}`}>
                  {formMsg.text}
                </span>
              )}
            </div>
          </form>
        </div>
      </div>

      {/* Overdue Payments */}
      <div>
        <h2 className="text-lg font-semibold text-gray-800 mb-3">Overdue Payments</h2>
        <div className="bg-white rounded-lg border border-gray-200 overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Project</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Kind</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Amount</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Created</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Follow-up</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {isLoading && (
                <tr><td colSpan={6} className="px-4 py-6 text-center text-gray-400 text-sm">Loading…</td></tr>
              )}
              {overdue?.map((p) => (
                <tr key={p._id}>
                  <td className="px-4 py-3 font-medium text-gray-800">{p.project?.title ?? '—'}</td>
                  <td className="px-4 py-3 text-gray-600 capitalize">{p.kind}</td>
                  <td className="px-4 py-3 font-medium text-gray-800">{formatINR(p.amount)}</td>
                  <td className="px-4 py-3 text-gray-500">
                    {new Date(p.createdAt).toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata' })}
                  </td>
                  <td className="px-4 py-3">
                    {p.followUpSentAt ? (
                      <span className="inline-flex items-center gap-1 text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full">
                        Sent {new Date(p.followUpSentAt).toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata' })}
                      </span>
                    ) : (
                      <span className="text-xs text-gray-400">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <button
                      onClick={() => followUpMutation.mutate(p._id)}
                      disabled={!canSendFollowUp(p.followUpSentAt) || followUpMutation.isPending}
                      className="text-xs bg-amber-500 text-white px-3 py-1.5 rounded hover:bg-amber-600 disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      Send Follow-up
                    </button>
                  </td>
                </tr>
              ))}
              {!isLoading && overdue?.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-gray-400 text-sm">
                    No overdue payments.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
