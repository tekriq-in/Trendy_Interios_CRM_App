'use client';

import { usePathname } from 'next/navigation';

const PAGE_TITLES: Record<string, string> = {
  '/dashboard': 'Dashboard',
  '/dashboard/projects': 'Projects',
  '/dashboard/approvals': 'Approvals',
  '/dashboard/blockers': 'Blockers',
  '/dashboard/handovers': 'Handovers',
  '/dashboard/payments': 'Payments',
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

export function Header() {
  const pathname = usePathname();
  const title = getTitle(pathname);

  return (
    <header className="h-14 bg-white border-b border-slate-200 px-6 flex items-center justify-between shrink-0">
      <p className="text-sm font-semibold text-slate-900">{title}</p>
      <div className="flex items-center gap-2">
        <div className="w-8 h-8 rounded-full bg-indigo-600 flex items-center justify-center text-white text-xs font-bold">
          MD
        </div>
        <span className="text-sm text-slate-600 hidden sm:block">Managing Director</span>
      </div>
    </header>
  );
}
