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
    items: [
      { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard, exact: true },
    ],
  },
  {
    label: 'OPERATIONS',
    items: [
      { href: '/dashboard/clients', label: 'Clients', icon: UserCircle2 },
      { href: '/dashboard/projects', label: 'Projects', icon: FolderKanban },
      { href: '/dashboard/approvals', label: 'Approvals', icon: CheckSquare },
      { href: '/dashboard/blockers', label: 'Blockers', icon: AlertTriangle },
      { href: '/dashboard/handovers', label: 'Handovers', icon: ArrowLeftRight },
    ],
  },
  {
    label: 'MANAGEMENT',
    items: [
      { href: '/dashboard/users', label: 'Employees', icon: Users },
      { href: '/dashboard/roles', label: 'Roles', icon: Shield },
      { href: '/dashboard/departments', label: 'Departments', icon: Building2 },
      { href: '/dashboard/sla', label: 'SLA Settings', icon: Clock },
    ],
  },
  {
    label: 'SYSTEM',
    items: [
      { href: '/dashboard/activity-log', label: 'Activity Log', icon: ScrollText },
    ],
  },
];

export function Sidebar() {
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
    <aside className="w-64 bg-slate-900 flex flex-col shrink-0 h-full">
      {/* Logo */}
      <div className="h-16 flex items-center gap-3 px-5 border-b border-slate-800">
        <div className="w-9 h-9 rounded-lg bg-indigo-600 flex items-center justify-center text-white font-bold text-sm shrink-0">
          TI
        </div>
        <div className="min-w-0">
          <p className="text-white font-semibold text-sm leading-tight truncate">Trendy Interios</p>
          <p className="text-slate-400 text-xs leading-tight">CRM Platform</p>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto py-4 px-3 space-y-5">
        {NAV_GROUPS.map((group) => (
          <div key={group.label}>
            <p className="text-slate-500 text-xs font-semibold tracking-wider px-2 mb-1.5">
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
                    className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                      active
                        ? 'bg-indigo-600 text-white'
                        : 'text-slate-400 hover:text-white hover:bg-slate-800'
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
            <p className="text-white text-sm font-medium leading-tight truncate">{user?.name ?? 'Admin'}</p>
            <p className="text-slate-500 text-xs leading-tight truncate">{user?.role ?? 'Managing Director'}</p>
          </div>
          <button
            onClick={handleLogout}
            className="text-slate-500 hover:text-white transition-colors p-1 rounded"
            title="Sign out"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>
    </aside>
  );
}
