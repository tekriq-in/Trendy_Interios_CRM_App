'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  LayoutDashboard,
  FolderKanban,
  CheckSquare,
  AlertTriangle,
  ArrowLeftRight,
  UserCircle2,
  Users,
  Shield,
  Building2,
  Clock,
  ScrollText,
  MessageSquare,
  GitBranch,
  LogOut,
  type LucideIcon,
} from 'lucide-react';
import { useAuthStore } from '@/store/auth.store';

interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  exact?: boolean;
}

interface NavGroup {
  label: string;
  items: NavItem[];
}

const NAV_GROUPS: NavGroup[] = [
  {
    label: 'OVERVIEW',
    items: [{ href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard, exact: true }],
  },
  {
    label: 'OPERATIONS',
    items: [
      { href: '/dashboard/clients', label: 'Clients', icon: UserCircle2 },
      { href: '/dashboard/projects', label: 'Projects', icon: FolderKanban },
      { href: '/dashboard/approvals', label: 'Approvals', icon: CheckSquare },
      { href: '/dashboard/blockers', label: 'Blockers', icon: AlertTriangle },
      { href: '/dashboard/handovers', label: 'Handovers', icon: ArrowLeftRight },
      { href: '/dashboard/chat', label: 'Chat', icon: MessageSquare },
    ],
  },
  {
    label: 'MANAGEMENT',
    items: [
      { href: '/dashboard/users', label: 'Employees', icon: Users },
      { href: '/dashboard/org-chart', label: 'Org Chart', icon: GitBranch },
      { href: '/dashboard/roles', label: 'Roles', icon: Shield },
      { href: '/dashboard/departments', label: 'Departments', icon: Building2 },
      { href: '/dashboard/sla', label: 'SLA Settings', icon: Clock },
    ],
  },
  {
    label: 'SYSTEM',
    items: [{ href: '/dashboard/activity-log', label: 'Activity Log', icon: ScrollText }],
  },
];

export function Sidebar({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();
  const router = useRouter();
  const clearAuth = useAuthStore((s) => s.clearAuth);
  const user = useAuthStore((s) => s.user);

  function isActive(item: NavItem) {
    if (item.exact) return pathname === item.href;
    return pathname === item.href || pathname.startsWith(item.href + '/');
  }

  function handleLogout() {
    clearAuth();
    router.push('/login');
  }

  return (
    <aside className="w-60 bg-[#181c32] flex flex-col shrink-0 h-full text-white">
      {/* Logo */}
      <div className="h-20 flex items-center gap-3 px-6 border-b border-white/10">
        <div className="w-10 h-10 rounded-xl bg-indigo-500 flex items-center justify-center text-white font-bold text-sm shrink-0 ring-4 ring-indigo-500/10">
          TI
        </div>
        <div className="min-w-0">
          <p className="text-white font-semibold text-sm leading-tight truncate">Trendy Interios</p>
          <p className="text-slate-400 text-[10px] tracking-[0.18em] uppercase mt-1">
            Studio workspace
          </p>
        </div>
      </div>

      {/* Nav */}
      <nav aria-label="Main navigation" className="flex-1 overflow-y-auto py-6 px-3 space-y-6">
        {NAV_GROUPS.map((group) => (
          <div key={group.label}>
            <p className="text-slate-400 text-[10px] font-semibold tracking-[0.16em] px-3 mb-2">
              {group.label}
            </p>
            <div className="space-y-0.5">
              {group.items.map((item) => {
                const active = isActive(item);
                const Icon = item.icon;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={onNavigate}
                    aria-current={active ? 'page' : undefined}
                    className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                      active
                        ? 'bg-indigo-500/20 text-indigo-100 ring-1 ring-inset ring-indigo-400/25'
                        : 'text-slate-300 hover:text-white hover:bg-white/5'
                    }`}
                  >
                    <Icon className="w-4 h-4 shrink-0" />
                    {item.label}
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      {/* User / Logout */}
      <div className="p-3 border-t border-slate-800">
        <div className="flex items-center gap-3 px-2 py-2">
          <div className="w-8 h-8 rounded-full bg-indigo-600 flex items-center justify-center text-white text-xs font-bold shrink-0">
            {user?.initials ?? 'MD'}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-white text-sm font-medium leading-tight truncate">
              {user?.name ?? 'Admin'}
            </p>
            <p className="text-slate-400 text-xs leading-tight truncate">
              {user?.role ?? 'Workspace'}
            </p>
          </div>
          <button
            onClick={handleLogout}
            className="flex items-center gap-1.5 text-slate-400 hover:text-white transition-colors px-2 py-1.5 rounded-lg text-xs font-medium hover:bg-white/5"
            aria-label="Sign out"
          >
            <LogOut className="w-3.5 h-3.5 shrink-0" />
            Sign out
          </button>
        </div>
      </div>
    </aside>
  );
}
