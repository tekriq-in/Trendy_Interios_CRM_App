import { DashboardShell } from '@/components/layout/DashboardShell';
import { ToastProvider } from '@/components/ui/Toast';
import type { ReactNode } from 'react';

export default function DashboardLayout({ children }: { children: ReactNode }) {
  return (
    <ToastProvider>
      <DashboardShell>{children}</DashboardShell>
    </ToastProvider>
  );
}
