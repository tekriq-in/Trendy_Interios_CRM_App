'use client';

import { useEffect } from 'react';
import { X, Download, ExternalLink, FileText, Image as ImageIcon } from 'lucide-react';

interface Props {
  url: string;
  mimeType: string;
  fileName: string;
  onClose: () => void;
}

export function FileViewerModal({ url, mimeType, fileName, onClose }: Props) {
  const isPdf = mimeType === 'application/pdf' || fileName.toLowerCase().endsWith('.pdf');
  const isImage = mimeType.startsWith('image/');
  // Proxy PDF through our own route to strip Cloudinary's X-Frame-Options: DENY header
  const embedUrl = isPdf ? `/api/file-proxy?url=${encodeURIComponent(url)}` : url;

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
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
        {isPdf ? (
          <FileText className="w-4 h-4 text-slate-400 shrink-0" />
        ) : (
          <ImageIcon className="w-4 h-4 text-slate-400 shrink-0" />
        )}
        <span className="text-sm text-slate-200 font-medium flex-1 truncate">{fileName}</span>
        <a
          href={url}
          target="_blank"
          rel="noreferrer"
          className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-white px-2.5 py-1.5 rounded-lg hover:bg-white/10 transition-colors shrink-0"
          title="Open in new tab"
        >
          <ExternalLink className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">Open</span>
        </a>
        <a
          href={url}
          download={fileName}
          className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-white px-2.5 py-1.5 rounded-lg hover:bg-white/10 transition-colors shrink-0"
          title="Download"
        >
          <Download className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">Download</span>
        </a>
        <button
          onClick={onClose}
          className="p-1.5 text-slate-400 hover:text-white hover:bg-white/10 rounded-lg transition-colors shrink-0"
          aria-label="Close viewer"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-hidden flex items-center justify-center p-2 sm:p-4">
        {isPdf ? (
          <iframe
            src={embedUrl}
            title={fileName}
            className="w-full h-full rounded-lg bg-white"
            style={{ border: 'none' }}
          />
        ) : isImage ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={url}
            alt={fileName}
            className="max-w-full max-h-full object-contain rounded-lg shadow-2xl"
          />
        ) : (
          <div className="flex flex-col items-center gap-4 text-slate-300">
            <FileText className="w-16 h-16 text-slate-500" />
            <p className="text-sm">Preview not available for this file type.</p>
            <a
              href={url}
              target="_blank"
              rel="noreferrer"
              className="text-indigo-400 hover:text-indigo-300 text-sm underline"
            >
              Open in new tab
            </a>
          </div>
        )}
      </div>
    </div>
  );
}
