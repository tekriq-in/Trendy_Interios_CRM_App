export function Table({ children }: { children: React.ReactNode }) {
  return (
    <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
      <table className="w-full text-sm">{children}</table>
    </div>
  );
}

export function Th({ children }: { children: React.ReactNode }) {
  return (
    <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide bg-slate-50 border-b border-slate-200">
      {children}
    </th>
  );
}

export function Td({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <td className={`px-4 py-3 text-slate-700 ${className ?? ''}`}>{children}</td>
  );
}

export function Tr({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <tr className={`border-b border-slate-100 last:border-0 hover:bg-slate-50 transition-colors ${className ?? ''}`}>
      {children}
    </tr>
  );
}
