'use client';

import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';
import { Printer, Loader2 } from 'lucide-react';

interface ShadeCardEntry {
  _id: string;
  area: string;
  units: string[];
  material: string;
  codeName: string;
  photoUrl?: string;
  remarks?: string;
  slNo: number;
  revision?: number;
}

interface Project {
  _id: string;
  title: string;
  client?: { name: string };
  targetDate?: string;
  shadeCardRevision?: number;
}

interface Props { params: { id: string }; }

export default function ShadeCardPrintPage({ params }: Props) {
  const { id } = params;

  const { data: project, isLoading: loadingProject } = useQuery<Project>({
    queryKey: ['project', id],
    queryFn: () => apiClient.get(`/projects/${id}`).then((r) => r.data),
  });

  const { data: entries = [], isLoading: loadingEntries } = useQuery<ShadeCardEntry[]>({
    queryKey: ['shade-card', id],
    queryFn: () => apiClient.get(`/projects/${id}/shade-card`).then((r) => r.data),
  });

  if (loadingProject || loadingEntries) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-indigo-500" />
      </div>
    );
  }

  const today = new Date().toLocaleDateString('en-IN', { day: '2-digit', month: '2-digit', year: 'numeric' });

  const sent = Math.max(project?.shadeCardRevision ?? 0, ...entries.map((e) => e.revision ?? 0));
  const hasUnsent = entries.some((e) => e.revision == null);
  const revisionLabel = hasUnsent ? `R${sent + 1} (draft)` : `R${sent}`;

  // Group by area in order of first appearance
  const areas: string[] = [];
  const grouped: Record<string, ShadeCardEntry[]> = {};
  entries.forEach((e) => {
    if (!grouped[e.area]) { grouped[e.area] = []; areas.push(e.area); }
    grouped[e.area].push(e);
  });

  return (
    <div className="min-h-screen bg-white">
      {/* Print button — hidden on print */}
      <div className="print:hidden sticky top-0 z-10 bg-white border-b border-slate-200 px-6 py-3 flex items-center justify-between">
        <span className="text-sm font-medium text-slate-600">Material Approval Sheet — {project?.title}</span>
        <button
          onClick={() => window.print()}
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-700 transition-colors"
        >
          <Printer className="w-4 h-4" />
          Print / Save PDF
        </button>
      </div>

      {/* Sheet — matches the sample format */}
      <div className="max-w-4xl mx-auto p-6 print:p-4 print:max-w-none">

        {/* Title */}
        <div className="border border-slate-800 text-center py-2 mb-0">
          <h1 className="text-base font-bold tracking-widest uppercase">Material Approval Sheet</h1>
        </div>

        {/* Header row */}
        <table className="w-full border-collapse text-xs mb-0">
          <tbody>
            <tr className="border border-slate-800">
              <td className="border border-slate-800 px-2 py-1.5 font-semibold w-1/4">
                CLIENT NAME: <span className="font-bold uppercase">{project?.client?.name ?? '—'}</span>
              </td>
              <td className="border border-slate-800 px-2 py-1.5 font-semibold w-1/4">
                ORDER NO: {project?.title ?? '—'}
              </td>
              <td className="border border-slate-800 px-2 py-1.5 font-semibold w-1/4">
                DATE: {today}
              </td>
              <td className="border border-slate-800 px-2 py-1.5 font-semibold w-1/4">
                REVISION: {revisionLabel}
              </td>
            </tr>
          </tbody>
        </table>

        {/* Column headers */}
        <table className="w-full border-collapse text-xs">
          <thead>
            <tr className="bg-slate-700 text-white">
              <th className="border border-slate-800 px-2 py-1.5 text-left w-10">SL NO</th>
              <th className="border border-slate-800 px-2 py-1.5 text-left">AREA</th>
              <th className="border border-slate-800 px-2 py-1.5 text-left w-24">MATERIAL</th>
              <th className="border border-slate-800 px-2 py-1.5 text-left w-36">CODE NAME</th>
              <th className="border border-slate-800 px-2 py-1.5 text-left w-40">PHOTOS</th>
              <th className="border border-slate-800 px-2 py-1.5 text-left w-28">REMARKS</th>
              <th className="border border-slate-800 px-2 py-1.5 text-center w-16">REV</th>
            </tr>
          </thead>
          <tbody>
            {areas.map((area) => {
              const areaEntries = grouped[area];
              return areaEntries.map((entry, idx) => (
                <>
                  {/* Area header row — only on first entry of this area */}
                  {idx === 0 && (
                    <tr key={`area-${area}`} className="bg-green-100">
                      <td colSpan={7} className="border border-slate-800 px-2 py-1 font-bold uppercase text-xs tracking-wide">
                        {area}
                      </td>
                    </tr>
                  )}
                  <tr key={entry._id} className={`align-top ${entry.revision == null && sent > 0 ? 'bg-yellow-50' : ''}`}>
                    <td className="border border-slate-800 px-2 py-2 text-center font-mono">{entry.slNo}</td>
                    <td className="border border-slate-800 px-2 py-2">
                      {entry.units.map((u, i) => (
                        <div key={i} className="text-xs leading-5">{u}</div>
                      ))}
                    </td>
                    <td className="border border-slate-800 px-2 py-2 font-semibold uppercase text-center">{entry.material}</td>
                    <td className="border border-slate-800 px-2 py-2 font-semibold">{entry.codeName}</td>
                    <td className="border border-slate-800 px-2 py-2">
                      {entry.photoUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={entry.photoUrl}
                          alt={entry.codeName}
                          className="w-32 h-20 object-cover rounded"
                        />
                      ) : (
                        <div className="w-32 h-20 bg-slate-100 rounded flex items-center justify-center text-slate-400 text-xs">No photo</div>
                      )}
                    </td>
                    <td className="border border-slate-800 px-2 py-2 text-xs text-slate-600">{entry.remarks ?? ''}</td>
                    <td className="border border-slate-800 px-2 py-2 text-center text-xs font-semibold">
                      {entry.revision != null ? `R${entry.revision}` : `R${sent + 1}${sent > 0 ? ' NEW' : ''}`}
                    </td>
                  </tr>
                </>
              ));
            })}
          </tbody>
        </table>

        {entries.length === 0 && (
          <div className="text-center py-12 text-slate-400 text-sm">No shade card entries for this project.</div>
        )}

        {/* Footer */}
        <div className="mt-8 print:mt-6 grid grid-cols-3 gap-8 text-xs text-slate-600">
          <div>
            <div className="border-t border-slate-400 pt-2 text-center">Client Signature</div>
          </div>
          <div>
            <div className="border-t border-slate-400 pt-2 text-center">Designer</div>
          </div>
          <div>
            <div className="border-t border-slate-400 pt-2 text-center">Authorised Signatory</div>
          </div>
        </div>
      </div>

      {/* Print styles */}
      <style>{`
        @media print {
          @page { margin: 1cm; size: A4; }
          body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
        }
      `}</style>
    </div>
  );
}
