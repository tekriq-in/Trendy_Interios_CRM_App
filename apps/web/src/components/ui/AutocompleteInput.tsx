'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { apiClient } from '@/lib/api-client';

export interface Suggestion {
  value: string;
  photoUrl: string | null;
}

interface Props {
  value: string;
  onChange: (v: string) => void;
  onSelect?: (s: Suggestion) => void;
  field: 'codeName' | 'area' | 'units';
  placeholder?: string;
  className?: string;
}

export function AutocompleteInput({ value, onChange, onSelect, field, placeholder, className }: Props) {
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const fetchSuggestions = useCallback((q: string) => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!q.trim()) { setSuggestions([]); setOpen(false); return; }
    debounceRef.current = setTimeout(async () => {
      try {
        const res = await apiClient.get<Suggestion[]>('/shade-card/suggestions', { params: { q, field } });
        const data = res.data ?? [];
        setSuggestions(data);
        setOpen(data.length > 0);
      } catch {
        setSuggestions([]);
        setOpen(false);
      }
    }, 150);
  }, [field]);

  useEffect(() => {
    fetchSuggestions(value);
  }, [value, fetchSuggestions]);

  // Close on outside click
  useEffect(() => {
    function handler(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  function handleSelect(s: Suggestion) {
    onChange(s.value);
    onSelect?.(s);
    setOpen(false);
  }

  return (
    <div ref={containerRef} className="relative">
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onFocus={() => fetchSuggestions(value)}
        placeholder={placeholder}
        className={className}
        autoComplete="off"
      />
      {open && suggestions.length > 0 && (
        <ul className="absolute z-50 left-0 right-0 mt-1 bg-white border border-slate-200 rounded-lg shadow-lg overflow-hidden text-sm max-h-56 overflow-y-auto">
          {suggestions.map((s) => (
            <li
              key={s.value}
              onMouseDown={(e) => { e.preventDefault(); handleSelect(s); }}
              className="flex items-center gap-2.5 px-3 py-2 cursor-pointer hover:bg-indigo-50 hover:text-indigo-700 transition-colors"
            >
              {s.photoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={s.photoUrl} alt={s.value} className="w-8 h-8 rounded object-cover shrink-0 border border-slate-100" />
              ) : (
                <div className="w-8 h-8 rounded bg-slate-100 shrink-0" />
              )}
              <span className="truncate">{s.value}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
