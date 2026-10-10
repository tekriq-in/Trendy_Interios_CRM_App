'use client';

import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { CheckCircle, XCircle, AlertTriangle, X } from 'lucide-react';

type ToastKind = 'success' | 'error' | 'warning';
interface Toast { id: string; kind: ToastKind; message: string; }

interface ToastCtx { toast: (kind: ToastKind, message: string) => void; }

const Ctx = createContext<ToastCtx>({ toast: () => {} });
export const useToast = () => useContext(Ctx);

const ICONS = {
  success: <CheckCircle className="w-4 h-4 text-emerald-500 shrink-0" />,
  error:   <XCircle    className="w-4 h-4 text-red-500    shrink-0" />,
  warning: <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0" />,
};
const BG = {
  success: 'border-emerald-200 bg-emerald-50',
  error:   'border-red-200    bg-red-50',
  warning: 'border-amber-200  bg-amber-50',
};
const TEXT = {
  success: 'text-emerald-800',
  error:   'text-red-800',
  warning: 'text-amber-800',
};

function ToastItem({ t, onDismiss }: { t: Toast; onDismiss: () => void }) {
  useEffect(() => {
    const id = setTimeout(onDismiss, 4000);
    return () => clearTimeout(id);
  }, [onDismiss]);

  return (
    <div className={`flex items-start gap-3 w-80 border rounded-xl px-4 py-3 shadow-lg animate-in slide-in-from-right ${BG[t.kind]}`}>
      {ICONS[t.kind]}
      <p className={`text-sm font-medium flex-1 leading-snug ${TEXT[t.kind]}`}>{t.message}</p>
      <button onClick={onDismiss} className="text-slate-400 hover:text-slate-600 p-0.5 shrink-0">
        <X className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const counterRef = useRef(0);

  const toast = useCallback((kind: ToastKind, message: string) => {
    const id = String(counterRef.current++);
    setToasts(prev => [...prev, { id, kind, message }]);
  }, []);

  const dismiss = useCallback((id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  return (
    <Ctx.Provider value={{ toast }}>
      {children}
      <div className="fixed bottom-4 right-4 z-[100] flex flex-col gap-2 pointer-events-none">
        {toasts.map(t => (
          <div key={t.id} className="pointer-events-auto">
            <ToastItem t={t} onDismiss={() => dismiss(t.id)} />
          </div>
        ))}
      </div>
    </Ctx.Provider>
  );
}
