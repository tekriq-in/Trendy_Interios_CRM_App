'use client';

import { usePathname } from 'next/navigation';
import { useAuthStore } from '@/store/auth.store';
import { Menu, ChevronRight, PanelsTopLeft } from 'lucide-react';
import Link from 'next/link';

const PAGE_TITLES: Record<string, string> = {
  '/dashboard': 'Dashboard',
  '/dashboard/clients': 'Clients',
  '/dashboard/roles': 'Roles',
  '/dashboard/projects': 'Projects',
  '/dashboard/approvals': 'Approvals',
  '/dashboard/blockers': 'Blockers',
  '/dashboard/handovers': 'Handovers',
  '/dashboard/users': 'Users',
  '/dashboard/departments': 'Departments',
  '/dashboard/sla': 'SLA Settings',
  '/dashboard/activity-log': 'Activity Log',
};

function getTitle(pathname: string): string {
  if (PAGE_TITLES[pathname]) return PAGE_TITLES[pathname];
  const base = Object.keys(PAGE_TITLES)
    .filter((k) => k !== '/dashboard' && pathname.startsWith(k))
    .sort((a, b) => b.length - a.length)[0];
  return base ? PAGE_TITLES[base] : 'Dashboard';
}

export function Header({ onOpenMenu }: { onOpenMenu?: () => void }) {
  const pathname = usePathname();
  const title = getTitle(pathname);
  const user = useAuthStore((s) => s.user);

  return (
    <header className="h-20 bg-white/90 border-b border-slate-200/80 px-4 sm:px-8 flex items-center justify-between gap-4 shrink-0">
      <div className="flex items-center gap-3 text-sm min-w-0">
        <button
          type="button"
          onClick={onOpenMenu}
          aria-label="Open navigation"
          aria-haspopup="dialog"
          className="rounded-lg p-3 text-slate-600 hover:bg-slate-100 lg:hidden"
        >
          <Menu className="h-5 w-5" />
        </button>
        <Link
          href="/dashboard"
          aria-label="Workspace home"
          className="hidden sm:flex items-center gap-2 text-slate-500 hover:text-indigo-600"
        >
          <PanelsTopLeft className="h-4 w-4" />
          <span>Workspace</span>
        </Link>
        <ChevronRight className="hidden sm:block h-3 w-3 text-slate-300" />
        <p className="font-semibold text-slate-900 truncate">{title}</p>
      </div>
      <div className="flex items-center gap-2.5">
        <div className="w-8 h-8 rounded-full bg-indigo-600 flex items-center justify-center text-white text-xs font-bold">
          {user?.initials ?? 'MD'}
        </div>
        <div className="hidden sm:block text-right">
          <p className="text-sm font-medium text-slate-800 leading-tight">
            {user?.name ?? 'Admin'}
          </p>
          <p className="text-xs text-slate-500 leading-tight mt-1">{user?.role ?? 'Workspace'}</p>
        </div>
      </div>
    </header>
  );
}
