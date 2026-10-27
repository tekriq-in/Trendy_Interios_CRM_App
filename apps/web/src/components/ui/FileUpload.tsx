'use client';

import { useRef, useState } from 'react';
import { Upload, X, ExternalLink, Loader2, FileText, Image } from 'lucide-react';
import { apiClient } from '@/lib/api-client';

export interface UploadedFile {
  _id: string;
  fileName: string;
  driveLink: string;
  mimeType: string;
}

interface Props {
  projectId?: string;
  type?: string;
  accept?: string;
  multiple?: boolean;
  label?: string;
  required?: boolean;
  onUploaded: (files: UploadedFile[]) => void;
}

export function FileUpload({
  projectId,
  type = 'photo',
  accept = 'image/*,.pdf',
  multiple = false,
  label,
  required = false,
  onUploaded,
}: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploaded, setUploaded] = useState<UploadedFile[]>([]);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const [dragging, setDragging] = useState(false);

  async function uploadFiles(files: FileList | null) {
    if (!files || files.length === 0) return;
    setUploading(true);
    setError('');

    const results: UploadedFile[] = [];
    for (const file of Array.from(files)) {
      try {
        const fd = new FormData();
        fd.append('file', file);
        if (projectId) fd.append('projectId', projectId);
        fd.append('type', type);
        const res = await apiClient.post<UploadedFile>('/documents/upload', fd, {
          headers: { 'Content-Type': 'multipart/form-data' },
        });
        results.push(res.data);
      } catch {
        setError(`Failed to upload ${file.name}. Please try again.`);
      }
    }

    if (results.length > 0) {
      const next = multiple ? [...uploaded, ...results] : results;
      setUploaded(next);
      onUploaded(next);
    }
    setUploading(false);
    if (inputRef.current) inputRef.current.value = '';
  }

  function removeFile(id: string) {
    const next = uploaded.filter((f) => f._id !== id);
    setUploaded(next);
    onUploaded(next);
  }

  function isImage(mime: string) {
    return mime.startsWith('image/');
  }

  return (
    <div className="space-y-2">
      {label && (
        <label className="block text-sm font-medium text-slate-700">
          {label}
          {required && <span className="text-red-500 ml-1">*</span>}
          {!required && <span className="text-slate-400 font-normal ml-1">(optional)</span>}
        </label>
      )}

      <input
        ref={inputRef}
        type="file"
        accept={accept}
        multiple={multiple}
        className="hidden"
        onChange={(e) => uploadFiles(e.target.files)}
      />

      {/* Drop zone */}
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          uploadFiles(e.dataTransfer.files);
        }}
        disabled={uploading}
        className={`w-full border-2 border-dashed rounded-xl py-5 px-4 flex flex-col items-center gap-2 transition-colors disabled:opacity-50 ${
          dragging
            ? 'border-indigo-500 bg-indigo-50'
            : uploaded.length > 0
            ? 'border-emerald-300 bg-emerald-50 hover:border-emerald-400'
            : 'border-slate-300 bg-slate-50 hover:border-indigo-400 hover:bg-indigo-50'
        }`}
      >
        {uploading ? (
          <Loader2 className="w-5 h-5 animate-spin text-indigo-500" />
        ) : (
          <Upload className={`w-5 h-5 ${uploaded.length > 0 ? 'text-emerald-600' : 'text-slate-400'}`} />
        )}
        <span className={`text-sm font-medium ${uploaded.length > 0 ? 'text-emerald-700' : 'text-slate-500'}`}>
          {uploading
            ? 'Uploading…'
            : uploaded.length > 0
            ? `${uploaded.length} file${uploaded.length > 1 ? 's' : ''} uploaded · click to add more`
            : `Click or drag ${multiple ? 'files' : 'a file'} here`}
        </span>
        <span className="text-xs text-slate-400">{accept.replace(/\./g, '').toUpperCase().replace(/,/g, ' · ')}</span>
      </button>

      {/* Error */}
      {error && (
        <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</p>
      )}

      {/* Uploaded file list */}
      {uploaded.length > 0 && (
        <div className="space-y-1.5">
          {uploaded.map((f) => (
            <div key={f._id} className="flex items-center gap-2.5 bg-white border border-slate-200 rounded-lg px-3 py-2">
              {isImage(f.mimeType) ? (
                <Image className="w-4 h-4 text-indigo-500 shrink-0" />
              ) : (
                <FileText className="w-4 h-4 text-slate-400 shrink-0" />
              )}
              <span className="text-sm text-slate-700 flex-1 truncate">{f.fileName}</span>
              {f.driveLink?.startsWith('http') && (
                <a
                  href={f.driveLink}
                  target="_blank"
                  rel="noreferrer"
                  className="p-1 text-slate-400 hover:text-indigo-600 shrink-0"
                  title="Open in Drive"
                  onClick={(e) => e.stopPropagation()}
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                </a>
              )}
              <button
                type="button"
                onClick={() => removeFile(f._id)}
                className="p-1 text-slate-300 hover:text-red-500 shrink-0"
                title="Remove"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
