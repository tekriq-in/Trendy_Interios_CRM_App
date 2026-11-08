'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { apiClient } from '@/lib/api-client';

interface Props {
  value: string;
  onChange: (v: string) => void;
  field: 'codeName' | 'area' | 'units';
  placeholder?: string;
  className?: string;
}

export function AutocompleteInput({ value, onChange, field, placeholder, className }: Props) {
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [open, setOpen] = useState(false);
  const [focused, setFocused] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const fetchSuggestions = useCallback((q: string) => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (q.length < 3) { setSuggestions([]); setOpen(false); return; }
    debounceRef.current = setTimeout(async () => {
      try {
        const res = await apiClient.get<string[]>('/shade-card/suggestions', { params: { q, field } });
        setSuggestions(res.data ?? []);
        setOpen((res.data ?? []).length > 0);
      } catch {
        setSuggestions([]);
        setOpen(false);
      }
    }, 200);
  }, [field]);

  useEffect(() => {
    if (focused) fetchSuggestions(value);
  }, [value, focused, fetchSuggestions]);

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

  return (
    <div ref={containerRef} className="relative">
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onFocus={() => { setFocused(true); fetchSuggestions(value); }}
        onBlur={() => setFocused(false)}
        placeholder={placeholder}
        className={className}
        autoComplete="off"
      />
      {open && suggestions.length > 0 && (
        <ul className="absolute z-50 left-0 right-0 mt-1 bg-white border border-slate-200 rounded-lg shadow-lg overflow-hidden text-sm">
          {suggestions.map((s) => (
            <li
              key={s}
              onMouseDown={(e) => { e.preventDefault(); onChange(s); setOpen(false); }}
              className="px-3 py-2 cursor-pointer hover:bg-indigo-50 hover:text-indigo-700 transition-colors truncate"
            >
              {s}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
