import { DashboardShell } from '@/components/layout/DashboardShell';
import { AuthGuard } from '@/components/layout/AuthGuard';
import { ToastProvider } from '@/components/ui/Toast';
import type { ReactNode } from 'react';

export default function DashboardLayout({ children }: { children: ReactNode }) {
  return (
    <ToastProvider>
      <AuthGuard>
        <DashboardShell>{children}</DashboardShell>
      </AuthGuard>
    </ToastProvider>
  );
}
