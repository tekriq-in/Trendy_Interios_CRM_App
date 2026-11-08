'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';
import { ShoppingCart, Truck, CheckCircle2, Package, Search, Filter } from 'lucide-react';

interface Project { _id: string; title: string; currentStage?: { name: string } | string; }
interface PurchaseItem {
  _id: string;
  item: string;
  quantity: number;
  unit: string;
  supplier?: string;
  status: 'pending' | 'ordered' | 'received';
  notes?: string;
  projectId: string;
  project?: { _id: string; title: string };
}

const STATUS_CONFIG = {
  pending:  { label: 'Pending',  icon: ShoppingCart,  cls: 'bg-slate-100 text-slate-700',  dot: 'bg-slate-400' },
  ordered:  { label: 'Ordered',  icon: Truck,          cls: 'bg-amber-100 text-amber-700',  dot: 'bg-amber-400' },
  received: { label: 'Received', icon: CheckCircle2,   cls: 'bg-emerald-100 text-emerald-700', dot: 'bg-emerald-500' },
} as const;

type Status = keyof typeof STATUS_CONFIG;

export default function PurchaseItemsPage() {
  const qc = useQueryClient();
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState<Status | 'all'>('all');
  const [filterProject, setFilterProject] = useState('all');

  const { data: projects = [] } = useQuery<Project[]>({
    queryKey: ['projects', 'purchase-items-page'],
    queryFn: () => apiClient.get<Project[]>('/projects').then((r) => r.data),
  });

  const { data: allItems = [], isLoading } = useQuery<PurchaseItem[]>({
    queryKey: ['purchase-items', 'all-projects', projects.map((p) => p._id).join(',')],
    queryFn: async () => {
      if (projects.length === 0) return [];
      const results = await Promise.all(
        projects.map((p) =>
          apiClient.get<PurchaseItem[]>(`/projects/${p._id}/purchase-items`).then((r) =>
            r.data.map((item) => ({ ...item, projectId: p._id, project: { _id: p._id, title: p.title } })),
          ),
        ),
      );
      return results.flat();
    },
    enabled: projects.length > 0,
  });

  const updateStatus = useMutation({
    mutationFn: ({ projectId, itemId, status }: { projectId: string; itemId: string; status: Status }) =>
      apiClient.patch(`/projects/${projectId}/purchase-items/${itemId}`, { status }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['purchase-items'] }),
  });

  const filtered = allItems.filter((item) => {
    const matchSearch = !search || item.item.toLowerCase().includes(search.toLowerCase()) ||
      item.supplier?.toLowerCase().includes(search.toLowerCase()) ||
      item.project?.title.toLowerCase().includes(search.toLowerCase());
    const matchStatus = filterStatus === 'all' || item.status === filterStatus;
    const matchProject = filterProject === 'all' || item.projectId === filterProject;
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
        <p className="text-sm text-slate-500 mt-1">Track all procurement across active projects.</p>
      </div>

      {/* Summary pills */}
      <div className="flex flex-wrap gap-3">
        {(['all', 'pending', 'ordered', 'received'] as const).map((s) => {
          const cfg = s === 'all' ? null : STATUS_CONFIG[s];
          const isActive = filterStatus === s;
          return (
            <button
              key={s}
              onClick={() => setFilterStatus(s)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors border ${
                isActive
                  ? 'bg-indigo-600 text-white border-indigo-600'
                  : 'bg-white text-slate-600 border-slate-200 hover:border-indigo-300'
              }`}
            >
              {cfg ? <cfg.icon className="w-3.5 h-3.5" /> : <Package className="w-3.5 h-3.5" />}
              {s === 'all' ? 'All items' : cfg!.label}
              <span className={`text-xs px-1.5 py-0.5 rounded-full font-semibold ${isActive ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-600'}`}>
                {counts[s]}
              </span>
            </button>
          );
        })}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search items, suppliers, projects…"
            className="w-full pl-9 pr-4 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
          />
        </div>
        <div className="relative">
          <Filter className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
          <select
            value={filterProject}
            onChange={(e) => setFilterProject(e.target.value)}
            className="pl-9 pr-8 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 appearance-none bg-white"
          >
            <option value="all">All projects</option>
            {projects.map((p) => (
              <option key={p._id} value={p._id}>{p.title}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        {isLoading ? (
          <div className="p-8 text-center text-sm text-slate-400">Loading purchase items…</div>
        ) : filtered.length === 0 ? (
          <div className="p-8 text-center">
            <Package className="w-10 h-10 text-slate-300 mx-auto mb-3" />
            <p className="text-sm text-slate-400">No purchase items found.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50">
                  <th className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wider px-4 py-3">Item</th>
                  <th className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wider px-4 py-3">Project</th>
                  <th className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wider px-4 py-3">Qty</th>
                  <th className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wider px-4 py-3">Supplier</th>
                  <th className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wider px-4 py-3">Status</th>
                  <th className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wider px-4 py-3">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filtered.map((item) => {
                  const cfg = STATUS_CONFIG[item.status];
                  const Icon = cfg.icon;
                  return (
                    <tr key={item._id} className="hover:bg-slate-50 transition-colors">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <span className={`w-2 h-2 rounded-full shrink-0 ${cfg.dot}`} />
                          <span className="font-medium text-slate-800">{item.item}</span>
                        </div>
                        {item.notes && <p className="text-xs text-slate-400 mt-0.5 ml-4">{item.notes}</p>}
                      </td>
                      <td className="px-4 py-3 text-slate-600 max-w-[180px] truncate">{item.project?.title ?? '—'}</td>
                      <td className="px-4 py-3 text-slate-600 whitespace-nowrap">{item.quantity} {item.unit}</td>
                      <td className="px-4 py-3 text-slate-600">{item.supplier ?? <span className="text-slate-300">—</span>}</td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold ${cfg.cls}`}>
                          <Icon className="w-3 h-3" />
                          {cfg.label}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1">
                          {item.status === 'pending' && (
                            <button
                              onClick={() => updateStatus.mutate({ projectId: item.projectId, itemId: item._id, status: 'ordered' })}
                              disabled={updateStatus.isPending}
                              className="px-2.5 py-1 rounded-lg text-xs font-medium bg-amber-50 text-amber-700 hover:bg-amber-100 transition-colors disabled:opacity-50"
                            >
                              Mark Ordered
                            </button>
                          )}
                          {item.status === 'ordered' && (
                            <button
                              onClick={() => updateStatus.mutate({ projectId: item.projectId, itemId: item._id, status: 'received' })}
                              disabled={updateStatus.isPending}
                              className="px-2.5 py-1 rounded-lg text-xs font-medium bg-emerald-50 text-emerald-700 hover:bg-emerald-100 transition-colors disabled:opacity-50"
                            >
                              Mark Received
                            </button>
                          )}
                          {item.status === 'received' && (
                            <span className="text-xs text-slate-400">Done</span>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
