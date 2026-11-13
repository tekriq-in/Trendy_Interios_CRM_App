'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';
import type { ActivityLog } from '@ti/shared';

const ENTITIES = ['', 'projects', 'approvals', 'tasks', 'handovers', 'blockers', 'users', 'departments'];

interface Filters {
  actor: string;
  entity: string;
  action: string;
  from: string;
  to: string;
  limit: number;
}

const DEFAULT_FILTERS: Filters = { actor: '', entity: '', action: '', from: '', to: '', limit: 50 };

function buildQS(f: Filters) {
  const p = new URLSearchParams();
  if (f.actor) p.set('actor', f.actor);
  if (f.entity) p.set('entity', f.entity);
  if (f.action) p.set('action', f.action);
  if (f.from) p.set('from', f.from);
  if (f.to) p.set('to', f.to);
  p.set('limit', String(f.limit));
  return p.toString();
}

export default function ActivityLogPage() {
  const [filters, setFilters] = useState<Filters>(DEFAULT_FILTERS);
  const [applied, setApplied] = useState<Filters>(DEFAULT_FILTERS);

  const { data, isLoading } = useQuery<{ data: ActivityLog[]; total: number }>({
    queryKey: ['activity-log', applied],
    queryFn: () => apiClient.get(`/activity-log?${buildQS(applied)}`).then((r) => r.data),
  });

  function apply() { setApplied({ ...filters }); }
  function clear() {
    setFilters(DEFAULT_FILTERS);
    setApplied(DEFAULT_FILTERS);
  }
  function loadMore() {
    const next = { ...applied, limit: applied.limit + 50 };
    setApplied(next);
    setFilters(next);
  }

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold text-gray-900">Activity Log</h1>

      {/* Filter bar */}
      <div className="bg-white rounded-lg border border-gray-200 p-4">
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          <div>
            <label className="block text-xs text-gray-500 mb-1">Actor ID</label>
            <input
              value={filters.actor}
              onChange={(e) => setFilters((f) => ({ ...f, actor: e.target.value }))}
              placeholder="ObjectId"
              className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Entity</label>
            <select
              value={filters.entity}
              onChange={(e) => setFilters((f) => ({ ...f, entity: e.target.value }))}
              className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              {ENTITIES.map((e) => (
                <option key={e} value={e}>{e || 'All entities'}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Action</label>
            <input
              value={filters.action}
              onChange={(e) => setFilters((f) => ({ ...f, action: e.target.value }))}
              placeholder="e.g. approval.approved"
              className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Date From</label>
            <input
              type="date"
              value={filters.from}
              onChange={(e) => setFilters((f) => ({ ...f, from: e.target.value }))}
              className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Date To</label>
            <input
              type="date"
              value={filters.to}
              onChange={(e) => setFilters((f) => ({ ...f, to: e.target.value }))}
              className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
        </div>
        <div className="flex gap-2 mt-3">
          <button
            onClick={apply}
            className="bg-indigo-600 text-white px-4 py-1.5 rounded text-sm hover:bg-indigo-700"
          >
            Apply Filters
          </button>
          <button
            onClick={clear}
            className="border border-gray-300 text-gray-600 px-4 py-1.5 rounded text-sm hover:bg-gray-50"
          >
            Clear
          </button>
        </div>
      </div>

      <p className="text-sm text-gray-500">{data?.total ?? 0} total entries</p>

      {isLoading && <p className="text-sm text-gray-500">Loading…</p>}

      <div className="bg-white rounded-lg border border-gray-200 divide-y">
        {data?.data.map((entry) => (
          <div key={entry._id} className="px-4 py-3">
            <div className="flex items-center justify-between">
              <p className="text-sm font-mono text-blue-700 font-medium">{entry.action}</p>
              <p className="text-xs text-gray-400">
                {new Date(entry.createdAt).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })}
              </p>
            </div>
            <p className="text-xs text-gray-500 mt-0.5">
              {typeof entry.actor === 'object' && entry.actor
                ? (entry.actor as { name: string }).name
                : 'System'}{' '}
              · {entry.entity} · {String(entry.entityId)}
            </p>
          </div>
        ))}
        {!isLoading && data?.data.length === 0 && (
          <div className="px-4 py-8 text-center text-sm text-gray-400">No activity yet.</div>
        )}
      </div>

      {data && data.data.length < data.total && (
        <div className="text-center">
          <button
            onClick={loadMore}
            className="text-sm text-indigo-600 hover:text-indigo-700 font-medium"
          >
            Load more ({data.total - data.data.length} remaining)
          </button>
        </div>
      )}
    </div>
  );
}
