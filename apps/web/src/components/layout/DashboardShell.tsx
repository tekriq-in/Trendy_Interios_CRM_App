'use client';

import { useEffect, useRef, type ReactNode } from 'react';
import { X } from 'lucide-react';
import { Sidebar } from './Sidebar';
import { Header } from './Header';

export function DashboardShell({ children }: { children: ReactNode }) {
  const menu = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const desktop = window.matchMedia('(min-width: 1024px)');
    const closeOnDesktop = () => {
      if (desktop.matches) menu.current?.close();
    };
    desktop.addEventListener('change', closeOnDesktop);
    return () => desktop.removeEventListener('change', closeOnDesktop);
  }, []);

  return (
    <div className="dashboard-shell flex h-dvh overflow-hidden bg-[#f6f7fb]">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-lg focus:bg-white focus:p-3"
      >
        Skip to content
      </a>
      <div className="hidden lg:block">
        <Sidebar />
      </div>
      <dialog
        ref={menu}
        aria-label="Navigation"
        className="m-0 h-dvh max-h-none w-[min(20rem,100vw)] max-w-none bg-[#181c32] p-0 text-white backdrop:bg-slate-950/50"
        onClick={(event) => {
          if (event.target === event.currentTarget) menu.current?.close();
        }}
      >
        <button
          autoFocus
          type="button"
          onClick={() => menu.current?.close()}
          aria-label="Close navigation"
          className="absolute right-2 top-4 rounded-lg p-3 hover:bg-white/10"
        >
          <X className="h-5 w-5" />
        </button>
        <Sidebar onNavigate={() => menu.current?.close()} />
      </dialog>
      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <Header onOpenMenu={() => menu.current?.showModal()} />
        <main id="main-content" tabIndex={-1} className="flex-1 overflow-y-auto p-4 sm:p-6 xl:p-8">
          <div className="mx-auto max-w-[1600px]">{children}</div>
        </main>
      </div>
    </div>
  );
}
