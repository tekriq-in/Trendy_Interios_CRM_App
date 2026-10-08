'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';
import { useState } from 'react';
import type { SlaSettings, Department } from '@ti/shared';

type SlaWithDept = SlaSettings & { department: Department };

export default function SlaPage() {
  const qc = useQueryClient();
  const [editing, setEditing] = useState<Record<string, number>>({});

  const { data: slaList, isLoading } = useQuery<SlaWithDept[]>({
    queryKey: ['sla'],
    queryFn: () => apiClient.get('/sla').then((r) => r.data),
  });

  const updateMutation = useMutation({
    mutationFn: ({ deptId, hours }: { deptId: string; hours: number }) =>
      apiClient.patch(`/sla/${deptId}`, { defaultHours: hours }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['sla'] });
      setEditing({});
    },
  });

  if (isLoading) return <p className="text-sm text-gray-500">Loading…</p>;

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold text-gray-900">SLA Settings</h1>
      <p className="text-sm text-gray-500">Configure default SLA hours per stage.</p>

      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Stage</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">
                Default Hours
              </th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {slaList?.map((s) => {
              const deptId = typeof s.department === 'object' ? s.department._id : s.department;
              const deptName =
                typeof s.department === 'object' ? s.department.name : deptId;
              const current = editing[deptId] ?? s.defaultHours;

              return (
                <tr key={deptId}>
                  <td className="px-4 py-3 font-medium text-gray-800">{deptName}</td>
                  <td className="px-4 py-3">
                    <input
                      type="number"
                      min={1}
                      value={current}
                      onChange={(e) =>
                        setEditing((prev) => ({ ...prev, [deptId]: Number(e.target.value) }))
                      }
                      className="w-24 border rounded px-2 py-1 text-sm"
                    />
                  </td>
                  <td className="px-4 py-3 text-right">
                    {editing[deptId] !== undefined && editing[deptId] !== s.defaultHours && (
                      <button
                        onClick={() => updateMutation.mutate({ deptId, hours: editing[deptId] })}
                        disabled={updateMutation.isPending}
                        className="text-xs bg-blue-600 text-white px-3 py-1.5 rounded hover:bg-blue-700 disabled:opacity-50"
                      >
                        Save
                      </button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
