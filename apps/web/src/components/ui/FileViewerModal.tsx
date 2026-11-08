'use client';

import { useEffect, useRef, useState } from 'react';
import { X, Download, ExternalLink, FileText, Image as ImageIcon, Loader2, ChevronLeft, ChevronRight } from 'lucide-react';

interface Props {
  url: string;
  mimeType: string;
  fileName: string;
  onClose: () => void;
}

export function FileViewerModal({ url, mimeType, fileName, onClose }: Props) {
  const isPdf = mimeType === 'application/pdf' || fileName.toLowerCase().endsWith('.pdf');
  const isImage = mimeType.startsWith('image/');
  const proxyUrl = `/api/file-proxy?url=${encodeURIComponent(url)}`;

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col bg-black/80 backdrop-blur-sm"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      {/* Top bar */}
      <div className="flex items-center gap-3 px-4 py-3 bg-slate-900/95 shrink-0">
        {isPdf
          ? <FileText className="w-4 h-4 text-slate-400 shrink-0" />
          : <ImageIcon className="w-4 h-4 text-slate-400 shrink-0" />}
        <span className="text-sm text-slate-200 font-medium flex-1 truncate">{fileName}</span>
        <a href={url} target="_blank" rel="noreferrer"
          className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-white px-2.5 py-1.5 rounded-lg hover:bg-white/10 transition-colors shrink-0">
          <ExternalLink className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">Open</span>
        </a>
        <a href={proxyUrl} download={fileName}
          className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-white px-2.5 py-1.5 rounded-lg hover:bg-white/10 transition-colors shrink-0">
          <Download className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">Download</span>
        </a>
        <button onClick={onClose}
          className="p-1.5 text-slate-400 hover:text-white hover:bg-white/10 rounded-lg transition-colors shrink-0"
          aria-label="Close viewer">
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-hidden flex items-center justify-center p-2 sm:p-4 min-h-0">
        {isPdf ? (
          <PdfCanvas proxyUrl={proxyUrl} />
        ) : isImage ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={url} alt={fileName}
            className="max-w-full max-h-full object-contain rounded-lg shadow-2xl" />
        ) : (
          <div className="flex flex-col items-center gap-4 text-slate-300">
            <FileText className="w-16 h-16 text-slate-500" />
            <p className="text-sm">Preview not available for this file type.</p>
            <a href={url} target="_blank" rel="noreferrer"
              className="text-indigo-400 hover:text-indigo-300 text-sm underline">
              Open in new tab
            </a>
          </div>
        )}
      </div>
    </div>
  );
}

function PdfCanvas({ proxyUrl }: { proxyUrl: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [pageNum, setPageNum] = useState(1);
  const [totalPages, setTotalPages] = useState(0);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const pdfDocRef = useRef<any>(null);
  const renderTaskRef = useRef<{ cancel: () => void } | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const pdfjsLib = await import('pdfjs-dist');
        pdfjsLib.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.mjs';

        const data = await fetch(proxyUrl).then((r) => r.arrayBuffer());
        if (cancelled) return;

        const pdf = await pdfjsLib.getDocument({ data }).promise;
        if (cancelled) return;

        pdfDocRef.current = pdf;
        setTotalPages(pdf.numPages);
        setLoading(false);
      } catch {
        if (!cancelled) setError(true);
      }
    }

    load();
    return () => { cancelled = true; };
  }, [proxyUrl]);

  useEffect(() => {
    if (!pdfDocRef.current || loading || error) return;

    async function renderPage() {
      const pdf = pdfDocRef.current;
      const page = await pdf.getPage(pageNum);
      const canvas = canvasRef.current;
      const container = containerRef.current;
      if (!canvas || !container) return;

      // Cancel any in-progress render
      if (renderTaskRef.current) {
        renderTaskRef.current.cancel();
        renderTaskRef.current = null;
      }

      const containerWidth = container.clientWidth;
      const containerHeight = container.clientHeight;
      const viewport = page.getViewport({ scale: 1 });
      const scale = Math.min(
        containerWidth / viewport.width,
        containerHeight / viewport.height,
        2, // max 2x scale
      );
      const scaled = page.getViewport({ scale });

      canvas.width = scaled.width;
      canvas.height = scaled.height;

      const ctx = canvas.getContext('2d')!;
      const task = page.render({ canvasContext: ctx, viewport: scaled });
      renderTaskRef.current = task;
      await task.promise;
    }

    renderPage().catch(() => {/* cancelled render, ignore */});
  }, [pageNum, loading, error]);

  if (loading) {
    return (
      <div className="flex flex-col items-center gap-3 text-slate-300">
        <Loader2 className="w-8 h-8 animate-spin text-indigo-400" />
        <p className="text-sm">Loading PDF…</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center gap-4 text-slate-300">
        <FileText className="w-16 h-16 text-slate-500" />
        <p className="text-sm">Could not load PDF preview.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center gap-3 w-full h-full min-h-0">
      {/* Page navigation */}
      {totalPages > 1 && (
        <div className="flex items-center gap-3 shrink-0">
          <button
            onClick={() => setPageNum((p) => Math.max(1, p - 1))}
            disabled={pageNum <= 1}
            className="p-1.5 rounded-lg bg-white/10 text-white disabled:opacity-40 hover:bg-white/20 transition-colors"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <span className="text-sm text-slate-300">
            Page {pageNum} of {totalPages}
          </span>
          <button
            onClick={() => setPageNum((p) => Math.min(totalPages, p + 1))}
            disabled={pageNum >= totalPages}
            className="p-1.5 rounded-lg bg-white/10 text-white disabled:opacity-40 hover:bg-white/20 transition-colors"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Canvas */}
      <div ref={containerRef} className="flex-1 overflow-auto w-full min-h-0 flex items-start justify-center">
        <canvas
          ref={canvasRef}
          className="rounded-lg shadow-2xl max-w-full"
          style={{ background: 'white' }}
        />
      </div>
    </div>
  );
}
