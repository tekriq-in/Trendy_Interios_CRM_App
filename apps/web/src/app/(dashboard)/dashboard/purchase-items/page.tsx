'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { ShoppingCart, Truck, CheckCircle2, Package, Search, Filter, PackageCheck, Undo2 } from 'lucide-react';
import { PERMISSIONS, PURCHASE_ITEM_STATUS_LABELS, type PurchaseItemStatus } from '@ti/shared';
import { apiClient } from '@/lib/api-client';
import { usePermissions } from '@/lib/usePermissions';
import {
  PurchaseStatusBadge,
  ReceiveQtyModal,
  fmtQty,
  usePurchaseStatusMutation,
  type PurchaseItemRow,
} from '@/components/projects/PurchaseItemsSection';

interface Project { _id: string; title: string; currentStage?: { name: string } | string; }
type Row = PurchaseItemRow & { project: { _id: string; title: string } };

const STATUS_ICON = { pending: ShoppingCart, ordered: Truck, received: CheckCircle2 } as const;

export default function PurchaseItemsPage() {
  const { hasPermission } = usePermissions();
  const canManage = hasPermission(PERMISSIONS.PURCHASE_ITEMS_MANAGE);
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState<PurchaseItemStatus | 'all'>('all');
  const [filterProject, setFilterProject] = useState('all');
  const [receiving, setReceiving] = useState<Row | null>(null);

  const { data: projects = [] } = useQuery<Project[]>({
    queryKey: ['projects', 'purchase-items-page'],
    queryFn: () => apiClient.get<Project[]>('/projects').then((r) => r.data),
  });

  const { data: allItems = [], isLoading } = useQuery<Row[]>({
    queryKey: ['purchase-items', 'all-projects', projects.map((p) => p._id).join(',')],
    queryFn: async () => {
      if (projects.length === 0) return [];
      const results = await Promise.all(
        projects.map((p) =>
          apiClient.get<PurchaseItemRow[]>(`/projects/${p._id}/purchase-items`).then((r) =>
            r.data.map((item) => ({ ...item, project: { _id: p._id, title: p.title } })),
          ),
        ),
      );
      return results.flat();
    },
    enabled: projects.length > 0,
  });

  const statusMut = usePurchaseStatusMutation();

  const q = search.trim().toLowerCase();
  const filtered = allItems.filter((item) => {
    const matchSearch = !q || [item.item, item.area, item.brand, item.code, item.size, item.finish, item.project.title]
      .some((v) => v?.toLowerCase().includes(q));
    const matchStatus = filterStatus === 'all' || item.status === filterStatus;
    const matchProject = filterProject === 'all' || item.project._id === filterProject;
    return matchSearch && matchStatus && matchProject;
  });

  const counts = {
    all: allItems.length,
    pending: allItems.filter((i) => i.status === 'pending').length,
    ordered: allItems.filter((i) => i.status === 'ordered').length,
    received: allItems.filter((i) => i.status === 'received').length,
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Purchase Items</h1>
        <p className="mt-1 text-sm text-slate-500">Track order, received and balance quantities across projects.</p>
      </div>

      {/* Summary pills */}
      <div className="flex flex-wrap gap-3">
        {(['all', 'pending', 'ordered', 'received'] as const).map((s) => {
          const Icon = s === 'all' ? Package : STATUS_ICON[s];
          const isActive = filterStatus === s;
          return (
            <button
              key={s}
              onClick={() => setFilterStatus(s)}
              className={`flex items-center gap-2 rounded-lg border px-4 py-2 text-sm font-medium transition-colors ${
                isActive
                  ? 'border-indigo-600 bg-indigo-600 text-white'
                  : 'border-slate-200 bg-white text-slate-600 hover:border-indigo-300'
              }`}
            >
              <Icon className="h-3.5 w-3.5" />
              {s === 'all' ? 'All items' : PURCHASE_ITEM_STATUS_LABELS[s]}
              <span className={`rounded-full px-1.5 py-0.5 text-xs font-semibold ${isActive ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-600'}`}>
                {counts[s]}
              </span>
            </button>
          );
        })}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <div className="relative min-w-48 flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search item, area, brand, code, project…"
            className="w-full rounded-lg border border-slate-200 py-2 pl-9 pr-4 text-sm focus:border-transparent focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>
        <div className="relative">
          <Filter className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <select
            value={filterProject}
            onChange={(e) => setFilterProject(e.target.value)}
            className="appearance-none rounded-lg border border-slate-200 bg-white py-2 pl-9 pr-8 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            <option value="all">All projects</option>
            {projects.map((p) => (
              <option key={p._id} value={p._id}>{p.title}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Table */}
      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
        {isLoading ? (
          <div className="p-8 text-center text-sm text-slate-400">Loading purchase items…</div>
        ) : filtered.length === 0 ? (
          <div className="p-8 text-center">
            <Package className="mx-auto mb-3 h-10 w-10 text-slate-300" />
            <p className="text-sm text-slate-400">No purchase items found.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1100px] text-sm">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50 text-xs font-semibold uppercase tracking-wider text-slate-500">
                  <th className="px-3 py-3 text-left">Project</th>
                  <th className="px-3 py-3 text-left">S.No</th>
                  <th className="px-3 py-3 text-left">Area</th>
                  <th className="px-3 py-3 text-left">Item name</th>
                  <th className="px-3 py-3 text-left">Brand</th>
                  <th className="px-3 py-3 text-left">Code</th>
                  <th className="px-3 py-3 text-left">Size</th>
                  <th className="px-3 py-3 text-left">Finish</th>
                  <th className="px-3 py-3 text-right">Order qty</th>
                  <th className="px-3 py-3 text-right">Received</th>
                  <th className="px-3 py-3 text-right">Balance</th>
                  <th className="px-3 py-3 text-left">Status</th>
                  {canManage && <th className="px-3 py-3 text-left">Actions</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filtered.map((item) => (
                  <tr key={item._id} className="transition-colors hover:bg-slate-50">
                    <td className="max-w-[160px] truncate px-3 py-3">
                      <Link href={`/dashboard/projects/${item.project._id}`} className="text-indigo-600 hover:underline">
                        {item.project.title}
                      </Link>
                    </td>
                    <td className="px-3 py-3 font-mono text-xs text-slate-400">{item.slNo}</td>
                    <td className="px-3 py-3 text-slate-600">{item.area || '—'}</td>
                    <td className="px-3 py-3 font-medium text-slate-800">{item.item}</td>
                    <td className="px-3 py-3 text-slate-600">{item.brand || '—'}</td>
                    <td className="px-3 py-3 text-slate-600">{item.code || '—'}</td>
                    <td className="px-3 py-3 text-slate-600">{item.size || '—'}</td>
                    <td className="px-3 py-3 text-slate-600">{item.finish || '—'}</td>
                    <td className="px-3 py-3 text-right tabular-nums">{fmtQty(item.quantity)}</td>
                    <td className="px-3 py-3 text-right tabular-nums text-emerald-700">{fmtQty(item.receivedQty)}</td>
                    <td className={`px-3 py-3 text-right font-semibold tabular-nums ${item.balanceQty > 0 ? 'text-amber-700' : 'text-slate-400'}`}>
                      {fmtQty(item.balanceQty)}
                    </td>
                    <td className="px-3 py-3"><PurchaseStatusBadge status={item.status} /></td>
                    {canManage && (
                      <td className="px-3 py-3">
                        <div className="flex items-center gap-1">
                          {item.status === 'pending' && (
                            <button
                              onClick={() => statusMut.mutate({ id: item._id, status: 'ordered' })}
                              disabled={statusMut.isPending}
                              className="inline-flex items-center gap-1 rounded-lg bg-blue-50 px-2 py-1 text-xs font-medium text-blue-700 hover:bg-blue-100 disabled:opacity-50"
                            >
                              <Truck className="h-3.5 w-3.5" /> Mark ordered
                            </button>
                          )}
                          {item.status === 'ordered' && (
                            <button
                              onClick={() => statusMut.mutate({ id: item._id, status: 'pending' })}
                              disabled={statusMut.isPending}
                              title="Back to yet to order"
                              className="inline-flex items-center rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 disabled:opacity-50"
                            >
                              <Undo2 className="h-3.5 w-3.5" />
                            </button>
                          )}
                          <button
                            onClick={() => setReceiving(item)}
                            className="inline-flex items-center gap-1 rounded-lg bg-emerald-50 px-2 py-1 text-xs font-medium text-emerald-700 hover:bg-emerald-100"
                          >
                            <PackageCheck className="h-3.5 w-3.5" /> Receive
                          </button>
                        </div>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {receiving && <ReceiveQtyModal row={receiving} onClose={() => setReceiving(null)} />}
    </div>
  );
}
