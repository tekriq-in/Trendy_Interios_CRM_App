'use client';

import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';
import { Loader2, Users } from 'lucide-react';

interface OrgNode {
  _id: string;
  name: string;
  email: string;
  role?: { name: string };
  department?: { name: string };
  reportsTo?: string | null;
  isActive?: boolean;
  children?: OrgNode[];
}

function buildTree(flat: OrgNode[]): OrgNode[] {
  const map = new Map<string, OrgNode>();
  flat.forEach((n) => map.set(n._id, { ...n, children: [] }));
  const roots: OrgNode[] = [];
  for (const n of map.values()) {
    const parentId = typeof n.reportsTo === 'string' ? n.reportsTo : null;
    if (parentId && map.has(parentId)) {
      map.get(parentId)!.children!.push(n);
    } else {
      roots.push(n);
    }
  }
  return roots;
}

const ROLE_COLORS: Record<string, string> = {
  MD: 'bg-indigo-100 text-indigo-800',
  GM: 'bg-violet-100 text-violet-800',
  'Department Head': 'bg-blue-100 text-blue-800',
  Employee: 'bg-slate-100 text-slate-700',
};

function OrgCard({ node, depth }: { node: OrgNode; depth: number }) {
  const roleLabel = node.role?.name ?? '';
  const colorCls = ROLE_COLORS[roleLabel] ?? 'bg-slate-100 text-slate-700';
  return (
    <div className="flex flex-col items-center">
      {/* Card */}
      <div className={`relative w-48 rounded-xl border bg-white shadow-sm p-3 flex flex-col items-center gap-1.5 ${!node.isActive ? 'opacity-50' : ''}`}>
        <div className="w-10 h-10 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-700 font-bold text-sm shrink-0">
          {node.name.charAt(0).toUpperCase()}
        </div>
        <p className="text-sm font-semibold text-slate-900 text-center leading-tight truncate max-w-full px-1">{node.name}</p>
        {roleLabel && (
          <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${colorCls}`}>{roleLabel}</span>
        )}
        {node.department?.name && (
          <span className="text-[10px] text-slate-400 truncate max-w-full">{node.department.name}</span>
        )}
      </div>

      {/* Children */}
      {(node.children ?? []).length > 0 && (
        <div className="flex flex-col items-center">
          {/* Vertical connector down */}
          <div className="w-px h-6 bg-slate-300" />
          {/* Horizontal connector */}
          {(node.children!.length > 1) && (
            <div
              className="h-px bg-slate-300"
              style={{ width: `${(node.children!.length - 1) * 224}px`, maxWidth: '100%' }}
            />
          )}
          {/* Child nodes */}
          <div className="flex gap-4 items-start mt-0">
            {node.children!.map((child) => (
              <div key={child._id} className="flex flex-col items-center">
                <div className="w-px h-6 bg-slate-300" />
                <OrgCard node={child} depth={depth + 1} />
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default function OrgChartPage() {
  const { data, isLoading, isError } = useQuery<OrgNode[]>({
    queryKey: ['org-chart'],
    queryFn: () => apiClient.get('/users/org-chart').then((r) => r.data),
  });

  const roots = data ? buildTree(data) : [];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Org Chart</h1>
        <p className="text-sm text-slate-500 mt-0.5">Team hierarchy — MD → GM → Department Heads → Employees</p>
      </div>

      {isLoading && (
        <div className="flex items-center justify-center h-48">
          <Loader2 className="w-6 h-6 animate-spin text-slate-400" />
        </div>
      )}

      {isError && (
        <div className="text-sm text-red-500 bg-red-50 border border-red-200 rounded-lg p-4">
          Failed to load org chart. Make sure you have the required permissions.
        </div>
      )}

      {!isLoading && !isError && roots.length === 0 && (
        <div className="flex flex-col items-center justify-center py-20 text-slate-400 gap-3">
          <Users className="w-10 h-10" />
          <p className="text-sm">No users found. Add employees from the Employees page.</p>
        </div>
      )}

      {!isLoading && roots.length > 0 && (
        <div className="overflow-auto pb-8">
          <div className="flex gap-8 justify-center min-w-max py-6 px-4">
            {roots.map((root) => (
              <OrgCard key={root._id} node={root} depth={0} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
