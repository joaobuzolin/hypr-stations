import { useState, useRef, useEffect, useMemo, useId } from 'react';

interface MultiSelectProps {
  label: string;
  placeholder: string;
  options: string[];
  selected: Set<string>;
  onChange: (selected: Set<string>) => void;
  searchable?: boolean;
}

export default function MultiSelect({
  label,
  placeholder,
  options,
  selected,
  onChange,
  searchable = true,
}: MultiSelectProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const wrapRef = useRef<HTMLDivElement>(null);
  const uid = useId();
  const labelId = `ms-label-${uid}`;
  const listboxId = `ms-listbox-${uid}`;

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('click', handler);
    return () => document.removeEventListener('click', handler);
  }, []);

  const filtered = useMemo(() => {
    if (!search) return options;
    const q = search.toLowerCase();
    return options.filter((o) => o.toLowerCase().includes(q));
  }, [options, search]);

  const toggle = (val: string) => {
    const next = new Set(selected);
    if (next.has(val)) next.delete(val);
    else next.add(val);
    onChange(next);
  };

  return (
    <div className="flex flex-col gap-1" ref={wrapRef}>
      <label id={labelId} className="text-micro font-medium uppercase tracking-wider text-[var(--text-muted)]">
        {label}
      </label>

      {/* Trigger */}
      <button
        type="button"
        onClick={() => setOpen(!open)}
        aria-expanded={open}
        aria-haspopup="listbox"
        aria-labelledby={labelId}
        className={`w-full flex items-center gap-1 min-h-[34px] px-3 py-1.5 rounded-lg
                    border text-left text-xs transition-colors cursor-pointer
                    bg-[var(--bg-surface2)] border-[var(--border)]
                    hover:border-[var(--border-hover)]
                    ${open ? 'border-[var(--accent)]' : ''}`}
      >
        {selected.size === 0 ? (
          <span className="text-[var(--text-muted)]">{placeholder}</span>
        ) : (
          <div className="flex flex-wrap gap-1 flex-1">
            {[...selected].map((val) => (
              <span
                key={val}
                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-micro font-medium
                           bg-[var(--accent-muted)] text-[var(--accent)]"
              >
                {val}
                <span
                  role="button"
                  tabIndex={0}
                  aria-label={`Remover ${val}`}
                  className="cursor-pointer opacity-60 hover:opacity-100"
                  onClick={(e) => { e.stopPropagation(); toggle(val); }}
                  onKeyDown={(e) => { if (e.key === 'Enter') { e.stopPropagation(); toggle(val); } }}
                >
                  ×
                </span>
              </span>
            ))}
          </div>
        )}

        <svg
          width="10" height="6" viewBox="0 0 10 6" aria-hidden="true"
          className={`shrink-0 text-[var(--text-muted)] transition-transform ${open ? 'rotate-180' : ''}`}
        >
          <path d="M0 0l5 6 5-6z" fill="currentColor" />
        </svg>
      </button>

      {/* Dropdown */}
      {open && (
        <div className="relative z-50">
          <div className="absolute top-1 left-0 right-0 rounded-lg border overflow-hidden
                          bg-[var(--bg-surface)] border-[var(--border)]
                          shadow-[var(--shadow-card-hover)]">

            {searchable && options.length > 6 && (
              <div className="p-2 border-b border-[var(--border)]">
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Buscar..."
                  aria-label={`Buscar em ${label}`}
                  className="w-full px-3 py-1.5 rounded-lg text-xs
                             bg-[var(--bg-surface2)] border border-[var(--border)]
                             text-[var(--text-primary)] placeholder:text-[var(--text-muted)]
                             outline-none focus:border-[var(--accent)]"
                  autoFocus
                />
              </div>
            )}

            <div role="listbox" id={listboxId} aria-labelledby={labelId} className="max-h-48 overflow-y-auto">
              {filtered.map((opt) => {
                const isSelected = selected.has(opt);
                return (
                  <button
                    key={opt}
                    type="button"
                    role="option"
                    aria-selected={isSelected}
                    onClick={() => toggle(opt)}
                    className={`w-full flex items-center gap-2 px-3 py-2 text-xs text-left
                                transition-colors cursor-pointer
                                ${isSelected
                                  ? 'bg-[var(--accent-muted)] text-[var(--accent)]'
                                  : 'text-[var(--text-secondary)] hover:bg-[var(--bg-surface2)]'
                                }`}
                  >
                    <span className={`w-3.5 h-3.5 rounded flex items-center justify-center shrink-0 border
                                      ${isSelected
                                        ? 'bg-[var(--accent)] border-[var(--accent)]'
                                        : 'border-[var(--border-hover)]'
                                      }`}
                      aria-hidden="true"
                    >
                      {isSelected && (
                        <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="var(--on-accent)" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                          <polyline points="20 6 9 17 4 12" />
                        </svg>
                      )}
                    </span>
                    {opt}
                  </button>
                );
              })}
              {filtered.length === 0 && (
                <div className="px-3 py-3 text-xs text-[var(--text-muted)] text-center">
                  Nenhum resultado
                </div>
              )}
            </div>

            {selected.size > 0 && (
              <button
                type="button"
                onClick={() => onChange(new Set())}
                className="w-full px-3 py-2 text-micro font-medium uppercase tracking-wider
                           text-[var(--text-muted)] hover:text-[var(--accent)]
                           border-t border-[var(--border)] transition-colors cursor-pointer"
              >
                Limpar seleção
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
