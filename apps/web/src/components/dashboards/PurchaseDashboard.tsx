'use client';

import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';
import { useAuthStore } from '@/store/auth.store';
import { FolderKanban, ShoppingCart, AlertTriangle, ArrowLeftRight, Package, Truck, CheckCircle2 } from 'lucide-react';

interface Project { _id: string; title: string; progressPct: number; currentStage?: { _id: string; name: string } | string; }
interface PurchaseItem { _id: string; item: string; quantity: number; unit: string; supplier?: string; status: 'pending' | 'ordered' | 'received'; project?: { _id: string; title: string }; }
interface Handover { _id: string; status: string; project?: { title: string }; fromDepartment?: { name: string }; toDepartment?: { name: string }; }
interface Blocker { _id: string; title: string; status: string; project?: { title: string }; }

const STATUS_STYLE: Record<string, string> = {
  pending:  'bg-slate-100 text-slate-600',
  ordered:  'bg-amber-100 text-amber-700',
  received: 'bg-emerald-100 text-emerald-700',
};
const STATUS_ICON: Record<string, React.ElementType> = {
  pending:  ShoppingCart,
  ordered:  Truck,
  received: CheckCircle2,
};

function StatCard({ icon: Icon, label, value, color }: { icon: React.ElementType; label: string; value: number; color: string }) {
  return (
    <div className="bg-white rounded-xl border border-slate-200 p-5 flex items-center gap-4">
      <div className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${color}`}>
        <Icon className="w-5 h-5" />
      </div>
      <div>
        <p className="text-2xl font-bold text-slate-900">{value}</p>
        <p className="text-xs text-slate-500 font-medium mt-0.5">{label}</p>
      </div>
    </div>
  );
}

export function PurchaseDashboard() {
  const user = useAuthStore((s) => s.user);

  const { data: projects = [] } = useQuery<Project[]>({
    queryKey: ['projects', 'purchase-dept'],
    queryFn: () => apiClient.get<Project[]>('/projects').then((r) =>
      r.data.filter((p) => {
        const stage = p.currentStage;
        if (!stage) return false;
        const name = typeof stage === 'object' ? stage.name : '';
        return name === 'Purchase';
      }),
    ),
  });

  // Fetch purchase items for all current purchase-stage projects
  const { data: allItems = [] } = useQuery<PurchaseItem[]>({
    queryKey: ['purchase-items', 'all', projects.map((p) => p._id).join(',')],
    queryFn: async () => {
      if (projects.length === 0) return [];
      const results = await Promise.all(
        projects.map((p) =>
          apiClient.get<PurchaseItem[]>(`/projects/${p._id}/purchase-items`).then((r) =>
            r.data.map((item) => ({ ...item, project: { _id: p._id, title: p.title } })),
          ),
        ),
      );
      return results.flat();
    },
    enabled: projects.length > 0,
    refetchInterval: 30_000,
  });

  const { data: handovers = [] } = useQuery<Handover[]>({
    queryKey: ['handovers', 'purchase'],
    queryFn: () => apiClient.get<Handover[]>('/handovers').then((r) => r.data),
  });

  const { data: blockers = [] } = useQuery<Blocker[]>({
    queryKey: ['blockers', 'purchase'],
    queryFn: () => apiClient.get<Blocker[]>('/blockers').then((r) => r.data.filter((b) => b.status === 'open')),
  });

  const pending  = allItems.filter((i) => i.status === 'pending');
  const ordered  = allItems.filter((i) => i.status === 'ordered');
  const received = allItems.filter((i) => i.status === 'received');
  const activeHandovers = handovers.filter((h) => h.status === 'draft' || h.status === 'confirmed');

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Purchase Dashboard</h1>
        <p className="text-sm text-slate-500 mt-1">Welcome back, {user?.name}. Here&apos;s your procurement workspace.</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard icon={FolderKanban}  label="Projects in Purchase" value={projects.length}  color="bg-indigo-50 text-indigo-600" />
        <StatCard icon={ShoppingCart}  label="Pending Orders"        value={pending.length}   color="bg-slate-50 text-slate-600" />
        <StatCard icon={Truck}         label="Items Ordered"          value={ordered.length}   color="bg-amber-50 text-amber-600" />
        <StatCard icon={CheckCircle2}  label="Items Received"         value={received.length}  color="bg-emerald-50 text-emerald-600" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Projects in Purchase stage */}
        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-slate-700 uppercase tracking-wider flex items-center gap-2">
              <FolderKanban className="w-4 h-4 text-indigo-500" /> Projects in Purchase
            </h2>
            <Link href="/dashboard/projects" className="text-xs text-indigo-600 hover:underline">View all</Link>
          </div>
          {projects.length === 0 ? (
            <p className="text-sm text-slate-400 text-center py-6">No projects currently in Purchase stage.</p>
          ) : (
            <div className="space-y-3">
              {projects.slice(0, 6).map((p) => (
                <Link key={p._id} href={`/dashboard/projects/${p._id}`}
                  className="flex items-center gap-3 p-3 rounded-lg hover:bg-slate-50 transition-colors group">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-slate-800 truncate group-hover:text-indigo-600">{p.title}</p>
                    <p className="text-xs text-slate-400 mt-0.5">{p.progressPct}% complete</p>
                  </div>
                  <div className="w-20 bg-slate-100 rounded-full h-1.5 shrink-0">
                    <div className="bg-indigo-500 h-1.5 rounded-full" style={{ width: `${p.progressPct}%` }} />
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>

        {/* Purchase Items by Status */}
        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-slate-700 uppercase tracking-wider flex items-center gap-2">
              <Package className="w-4 h-4 text-amber-500" /> Purchase Items
            </h2>
            <Link href="/dashboard/purchase-items" className="text-xs text-indigo-600 hover:underline">View all</Link>
          </div>

          {/* Status summary pills */}
          <div className="flex gap-2 mb-4">
            {[
              { label: 'Pending',  count: pending.length,  cls: 'bg-slate-100 text-slate-700' },
              { label: 'Ordered',  count: ordered.length,  cls: 'bg-amber-100 text-amber-700' },
              { label: 'Received', count: received.length, cls: 'bg-emerald-100 text-emerald-700' },
            ].map((s) => (
              <div key={s.label} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold ${s.cls}`}>
                <span className="text-base font-bold">{s.count}</span>
                {s.label}
              </div>
            ))}
          </div>

          {allItems.length === 0 ? (
            <p className="text-sm text-slate-400 text-center py-4">No purchase items yet.</p>
          ) : (
            <div className="space-y-2 max-h-48 overflow-y-auto">
              {[...pending, ...ordered].slice(0, 8).map((item) => {
                const Icon = STATUS_ICON[item.status];
                return (
                  <div key={item._id} className="flex items-center gap-3 p-2.5 rounded-lg bg-slate-50 border border-slate-100">
                    <Icon className={`w-3.5 h-3.5 shrink-0 ${item.status === 'ordered' ? 'text-amber-500' : 'text-slate-400'}`} />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-slate-800 truncate">{item.item}</p>
                      <p className="text-xs text-slate-400 truncate">{item.project?.title} · Qty {item.quantity} {item.unit}</p>
                    </div>
                    <span className={`text-xs px-1.5 py-0.5 rounded font-medium shrink-0 ${STATUS_STYLE[item.status]}`}>
                      {item.status}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Active Handovers */}
        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-slate-700 uppercase tracking-wider flex items-center gap-2">
              <ArrowLeftRight className="w-4 h-4 text-emerald-500" /> Active Handovers
            </h2>
            <Link href="/dashboard/handovers" className="text-xs text-indigo-600 hover:underline">View all</Link>
          </div>
          {activeHandovers.length === 0 ? (
            <p className="text-sm text-slate-400 text-center py-6">No active handovers.</p>
          ) : (
            <div className="space-y-2">
              {activeHandovers.slice(0, 5).map((h) => (
                <div key={h._id} className="flex items-center gap-3 p-3 rounded-lg bg-slate-50 border border-slate-100">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-slate-800 truncate">{h.project?.title ?? '—'}</p>
                    <p className="text-xs text-slate-400">{h.fromDepartment?.name} → {h.toDepartment?.name}</p>
                  </div>
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium shrink-0 ${h.status === 'confirmed' ? 'bg-amber-100 text-amber-700' : 'bg-slate-100 text-slate-600'}`}>
                    {h.status}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Suppliers summary */}
        {allItems.filter((i) => i.supplier).length > 0 && (
          <div className="bg-white rounded-xl border border-slate-200 p-5">
            <h2 className="text-sm font-semibold text-slate-700 uppercase tracking-wider flex items-center gap-2 mb-4">
              <Truck className="w-4 h-4 text-blue-500" /> Suppliers in Use
            </h2>
            <div className="space-y-2">
              {Array.from(new Set(allItems.filter((i) => i.supplier).map((i) => i.supplier!))).slice(0, 6).map((s) => {
                const count = allItems.filter((i) => i.supplier === s).length;
                return (
                  <div key={s} className="flex items-center justify-between p-2.5 rounded-lg bg-blue-50 border border-blue-100">
                    <span className="text-sm text-slate-800 font-medium">{s}</span>
                    <span className="text-xs text-blue-600 font-semibold">{count} item{count > 1 ? 's' : ''}</span>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Open Blockers */}
      {blockers.length > 0 && (
        <div className="bg-white rounded-xl border border-red-100 p-5">
          <h2 className="text-sm font-semibold text-slate-700 uppercase tracking-wider flex items-center gap-2 mb-4">
            <AlertTriangle className="w-4 h-4 text-red-500" /> Open Blockers
          </h2>
          <div className="space-y-2">
            {blockers.slice(0, 4).map((b) => (
              <div key={b._id} className="flex items-center gap-3 p-3 rounded-lg bg-red-50 border border-red-100">
                <div className="w-2 h-2 rounded-full bg-red-400 shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-slate-800 truncate">{b.title}</p>
                  <p className="text-xs text-slate-500 truncate">{b.project?.title ?? ''}</p>
                </div>
                <Link href="/dashboard/blockers" className="text-xs text-red-600 hover:underline shrink-0">View</Link>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
