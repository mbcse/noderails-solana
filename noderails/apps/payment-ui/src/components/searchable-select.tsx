'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { ChevronDown, Search, Check, X } from 'lucide-react';
import { clsx } from 'clsx';

// ── Searchable Select / Combobox ──

interface SelectOption {
  value: string;
  label: string;
  sublabel?: string;
  badge?: string;
  icon?: React.ReactNode;
}

interface SearchableSelectProps {
  options: SelectOption[];
  value: string | null;
  onChange: (value: string) => void;
  placeholder?: string;
  searchPlaceholder?: string;
  label?: string;
  className?: string;
}

export function SearchableSelect({
  options,
  value,
  onChange,
  placeholder = 'Select...',
  searchPlaceholder = 'Search...',
  label,
  className,
}: SearchableSelectProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const selected = options.find((o) => o.value === value);

  const filtered = search.trim()
    ? options.filter(
        (o) =>
          o.label.toLowerCase().includes(search.toLowerCase()) ||
          o.sublabel?.toLowerCase().includes(search.toLowerCase()),
      )
    : options;

  // Close on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
        setSearch('');
      }
    }
    if (open) document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [open]);

  // Focus search input on open
  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 0);
  }, [open]);

  const handleSelect = useCallback(
    (optionValue: string) => {
      onChange(optionValue);
      setOpen(false);
      setSearch('');
    },
    [onChange],
  );

  return (
    <div ref={containerRef} className={clsx('relative', className)}>
      {label && (
        <label className="text-xs font-semibold uppercase tracking-wider text-gray-500 mb-2 block">
          {label}
        </label>
      )}

      {/* Trigger */}
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className={clsx(
          'w-full flex items-center gap-3 rounded-lg border px-3.5 py-2.5 text-left transition-all',
          open
            ? 'border-[#635bff] ring-2 ring-[#635bff]/20'
            : 'border-gray-200 hover:border-gray-300',
          'bg-white',
        )}
      >
        {selected ? (
          <>
            {selected.icon && <span className="shrink-0">{selected.icon}</span>}
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-gray-900 truncate">
                {selected.label}
              </p>
              {selected.sublabel && (
                <p className="text-xs text-gray-500 truncate">
                  {selected.sublabel}
                </p>
              )}
            </div>
            {selected.badge && (
              <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-600">
                {selected.badge}
              </span>
            )}
          </>
        ) : (
          <span className="flex-1 text-sm text-gray-400">{placeholder}</span>
        )}
        <ChevronDown
          className={clsx(
            'h-4 w-4 text-gray-400 shrink-0 transition-transform',
            open && 'rotate-180',
          )}
        />
      </button>

      {/* Dropdown */}
      {open && (
        <div className="absolute left-0 right-0 z-50 mt-1 rounded-lg border border-gray-200 bg-white shadow-lg overflow-hidden">
          {/* Search */}
          {options.length > 3 && (
            <div className="flex items-center gap-2 border-b border-gray-100 px-3 py-2">
              <Search className="h-3.5 w-3.5 text-gray-400 shrink-0" />
              <input
                ref={inputRef}
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={searchPlaceholder}
                className="flex-1 bg-transparent text-sm text-gray-900 placeholder:text-gray-400 outline-none"
              />
              {search && (
                <button
                  onClick={() => setSearch('')}
                  className="text-gray-400 hover:text-gray-600 transition-colors"
                >
                  <X className="h-3 w-3" />
                </button>
              )}
            </div>
          )}

          {/* Options */}
          <div className="max-h-56 overflow-y-auto py-1">
            {filtered.length === 0 && (
              <div className="px-4 py-3 text-sm text-gray-400 text-center">
                No results found
              </div>
            )}
            {filtered.map((opt) => {
              const isSelected = value === opt.value;
              return (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => handleSelect(opt.value)}
                  className={clsx(
                    'w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors',
                    isSelected
                      ? 'bg-[#635bff]/5'
                      : 'hover:bg-gray-50',
                  )}
                >
                  {opt.icon && <span className="shrink-0">{opt.icon}</span>}
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-gray-900 truncate">
                      {opt.label}
                    </p>
                    {opt.sublabel && (
                      <p className="text-xs text-gray-500 truncate">
                        {opt.sublabel}
                      </p>
                    )}
                  </div>
                  {opt.badge && (
                    <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-600">
                      {opt.badge}
                    </span>
                  )}
                  {isSelected && (
                    <Check className="h-4 w-4 text-[#635bff] shrink-0" />
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
