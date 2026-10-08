'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';
import type { SlaSettings, Department } from '@ti/shared';

type SlaWithDept = SlaSettings & { department: Department };

interface SlaReportRow {
  projectId: string;
  projectTitle: string;
  stageName: string;
  hoursInStage: number;
  slaHours: number;
  breached: boolean;
  enteredAt: string;
}

export default function SlaPage() {
  const qc = useQueryClient();
  const [editing, setEditing] = useState<Record<string, number>>({});

  const { data: slaList, isLoading: slaLoading } = useQuery<SlaWithDept[]>({
    queryKey: ['sla'],
    queryFn: () => apiClient.get('/sla').then((r) => r.data),
  });

  const { data: report, isLoading: reportLoading, refetch: refetchReport } = useQuery<SlaReportRow[]>({
    queryKey: ['sla-report'],
    queryFn: () => apiClient.get('/sla/report').then((r) => r.data),
  });

  const updateMutation = useMutation({
    mutationFn: ({ deptId, hours }: { deptId: string; hours: number }) =>
      apiClient.patch(`/sla/${deptId}`, { defaultHours: hours }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['sla'] });
      setEditing({});
    },
  });

  function statusBadge(row: SlaReportRow) {
    if (row.breached) {
      return <span className="px-2 py-0.5 rounded text-xs font-medium bg-red-100 text-red-700">Breached</span>;
    }
    const pct = row.slaHours > 0 ? row.hoursInStage / row.slaHours : 0;
    if (pct >= 0.8) {
      return <span className="px-2 py-0.5 rounded text-xs font-medium bg-yellow-100 text-yellow-700">Warning</span>;
    }
    return <span className="px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-700">On Track</span>;
  }

  return (
    <div className="space-y-8">
      {/* Section A: SLA Settings */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900 mb-1">SLA Settings</h1>
        <p className="text-sm text-gray-500 mb-4">Configure default SLA hours per stage.</p>
        {slaLoading && <p className="text-sm text-gray-500">Loading…</p>}
        {slaList && (
          <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Stage</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Default Hours</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {slaList.map((s) => {
                  const deptId = typeof s.department === 'object' ? s.department._id : s.department;
                  const deptName = typeof s.department === 'object' ? s.department.name : deptId;
                  const current = editing[deptId] ?? s.defaultHours;
                  return (
                    <tr key={deptId}>
                      <td className="px-4 py-3 font-medium text-gray-800">{deptName}</td>
                      <td className="px-4 py-3">
                        <input
                          type="number"
                          min={1}
                          value={current}
                          onChange={(e) => setEditing((prev) => ({ ...prev, [deptId]: Number(e.target.value) }))}
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
        )}
      </div>

      {/* Section B: SLA Breach Report */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-semibold text-gray-800">SLA Breach Report</h2>
          <button
            onClick={() => refetchReport()}
            className="text-sm text-indigo-600 hover:text-indigo-700 font-medium"
          >
            ↻ Refresh
          </button>
        </div>
        {reportLoading && <p className="text-sm text-gray-500">Loading…</p>}
        {report && (
          <div className="bg-white rounded-lg border border-gray-200 overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Project</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Stage</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Hours in Stage</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">SLA Hours</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {report.map((row) => (
                  <tr key={row.projectId} className={row.breached ? 'bg-red-50' : undefined}>
                    <td className="px-4 py-3 font-medium text-gray-800">{row.projectTitle}</td>
                    <td className="px-4 py-3 text-gray-600">{row.stageName}</td>
                    <td className="px-4 py-3 text-gray-800">{row.hoursInStage.toFixed(1)}h</td>
                    <td className="px-4 py-3 text-gray-600">{row.slaHours}h</td>
                    <td className="px-4 py-3">{statusBadge(row)}</td>
                  </tr>
                ))}
                {report.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-4 py-8 text-center text-gray-400 text-sm">No active projects.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
