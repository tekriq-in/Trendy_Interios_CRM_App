'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import clsx from 'clsx';

const NAV_ITEMS = [
  { href: '/dashboard', label: 'Overview' },
  { href: '/dashboard/projects', label: 'Projects' },
  { href: '/dashboard/approvals', label: 'Approvals' },
  { href: '/dashboard/blockers', label: 'Blockers' },
  { href: '/dashboard/handovers', label: 'Handovers' },
  { href: '/dashboard/payments', label: 'Payments' },
  { href: '/dashboard/users', label: 'Users' },
  { href: '/dashboard/departments', label: 'Departments' },
  { href: '/dashboard/sla', label: 'SLA Settings' },
  { href: '/dashboard/activity-log', label: 'Activity Log' },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="w-56 bg-white border-r border-gray-200 flex flex-col">
      <div className="h-16 flex items-center px-4 border-b border-gray-200">
        <span className="font-bold text-gray-800 text-sm">Trendy Interiors</span>
      </div>
      <nav className="flex-1 py-4 overflow-y-auto">
        {NAV_ITEMS.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className={clsx(
              'flex items-center px-4 py-2 text-sm rounded-md mx-2 mb-1',
              pathname === item.href || pathname.startsWith(item.href + '/')
                ? 'bg-blue-50 text-blue-700 font-medium'
                : 'text-gray-600 hover:bg-gray-100',
            )}
          >
            {item.label}
          </Link>
        ))}
      </nav>
    </aside>
  );
}
