'use client';

import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';
import type { Payment } from '@ti/shared';
import { formatINR } from '@ti/shared';

type PaymentPopulated = Payment & { project?: { title: string }; collectedBy?: { name: string } };

export default function PaymentsPage() {
  const { data: overdue, isLoading } = useQuery<PaymentPopulated[]>({
    queryKey: ['payments-overdue'],
    queryFn: () => apiClient.get('/payments/overdue').then((r) => r.data),
  });

  if (isLoading) return <p className="text-sm text-gray-500">Loading…</p>;

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold text-gray-900">Overdue Payments</h1>

      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Project</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Kind</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Amount</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Created</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {overdue?.map((p) => (
              <tr key={p._id}>
                <td className="px-4 py-3 font-medium text-gray-800">
                  {p.project?.title ?? '—'}
                </td>
                <td className="px-4 py-3 text-gray-600">{p.kind}</td>
                <td className="px-4 py-3 font-medium text-gray-800">{formatINR(p.amount)}</td>
                <td className="px-4 py-3 text-gray-500">
                  {new Date(p.createdAt).toLocaleDateString('en-IN', {
                    timeZone: 'Asia/Kolkata',
                  })}
                </td>
              </tr>
            ))}
            {overdue?.length === 0 && (
              <tr>
                <td colSpan={4} className="px-4 py-8 text-center text-gray-400 text-sm">
                  No overdue payments.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
