import { useState, useRef, useEffect, useMemo, useId } from 'react';

interface MultiSelectProps {
  label: string;
  placeholder: string;
  options: string[];
  selected: Set<string>;
  onChange: (s: Set<string>) => void;
  searchable?: boolean;
}

export default function MultiSelect({ label, placeholder, options, selected, onChange, searchable = true }: MultiSelectProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const ref = useRef<HTMLDivElement>(null);
  const uid = useId();
  const lid = `ms-${uid}`;

  useEffect(() => {
    const h = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener('click', h); return () => document.removeEventListener('click', h);
  }, []);

  const filtered = useMemo(() => search ? options.filter(o => o.toLowerCase().includes(search.toLowerCase())) : options, [options, search]);
  const toggle = (v: string) => { const n = new Set(selected); n.has(v) ? n.delete(v) : n.add(v); onChange(n); };

  return (
    <div className="flex flex-col gap-1.5" ref={ref}>
      <label id={lid} className="text-[11px] font-medium tracking-[0.03em] text-[var(--text-muted)]">{label}</label>
      <button type="button" onClick={() => setOpen(!open)} aria-expanded={open} aria-haspopup="listbox" aria-labelledby={lid}
        className={`w-full flex items-center gap-1.5 h-[34px] px-3 rounded-lg border-[0.5px] text-left text-[12px] transition-all duration-200 cursor-pointer
          bg-[var(--bg-surface2)] hover:border-[var(--border-hover)]
          ${open ? 'border-[var(--accent)]' : 'border-[var(--border)]'}`}>
        {selected.size === 0
          ? <span className="text-[var(--text-muted)] truncate">{placeholder}</span>
          : <div className="flex flex-wrap gap-1 flex-1 overflow-hidden">
              {[...selected].slice(0, 3).map(v => (
                <span key={v} className="inline-flex items-center gap-0.5 px-2 py-0 rounded-md text-[11px] font-medium bg-[var(--accent-muted)] text-[var(--accent)]">
                  {v}
                  <span role="button" tabIndex={0} aria-label={`Remover ${v}`} className="cursor-pointer opacity-50 hover:opacity-100 ml-0.5"
                    onClick={e => { e.stopPropagation(); toggle(v); }} onKeyDown={e => { if (e.key === 'Enter') { e.stopPropagation(); toggle(v); } }}>×</span>
                </span>))}
              {selected.size > 3 && <span className="text-[11px] text-[var(--text-muted)]">+{selected.size - 3}</span>}
            </div>}
        <svg width="8" height="5" viewBox="0 0 8 5" aria-hidden="true" className={`shrink-0 ml-auto text-[var(--text-muted)] transition-transform duration-200 ${open ? 'rotate-180' : ''}`}>
          <path d="M0 0l4 5 4-5z" fill="currentColor" /></svg>
      </button>
      {open && (
        <div className="relative z-50">
          <div className="absolute top-1 left-0 right-0 rounded-[10px] border-[0.5px] overflow-hidden bg-[var(--bg-surface)] border-[var(--border-active)] shadow-[0_8px_32px_rgba(0,0,0,0.2)]">
            {searchable && options.length > 6 && (
              <div className="p-2 border-b border-[var(--border)]">
                <input type="text" value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar..."
                  aria-label={`Buscar em ${label}`} autoFocus
                  className="w-full px-2.5 py-1.5 rounded-md text-[12px] bg-[var(--bg-surface2)] border-[0.5px] border-[var(--border)] text-[var(--text-primary)] placeholder:text-[var(--text-muted)] outline-none focus:border-[var(--accent)] transition-colors" />
              </div>)}
            <div role="listbox" aria-labelledby={lid} className="max-h-44 overflow-y-auto">
              {filtered.map(opt => {
                const on = selected.has(opt);
                return (
                  <button key={opt} type="button" role="option" aria-selected={on} onClick={() => toggle(opt)}
                    className={`w-full flex items-center gap-2.5 px-3 py-2 text-[12px] text-left transition-colors duration-150 cursor-pointer
                      ${on ? 'bg-[var(--accent-muted)] text-[var(--accent)]' : 'text-[var(--text-secondary)] hover:bg-[var(--bg-surface2)]'}`}>
                    <span className={`w-3.5 h-3.5 rounded flex items-center justify-center shrink-0 border-[0.5px] transition-all duration-150
                      ${on ? 'bg-[var(--accent)] border-[var(--accent)]' : 'border-[var(--border-active)]'}`} aria-hidden="true">
                      {on && <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="var(--on-accent)" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>}
                    </span>{opt}
                  </button>);
              })}
              {!filtered.length && <div className="px-3 py-4 text-[12px] text-[var(--text-muted)] text-center">Nenhum resultado</div>}
            </div>
            {selected.size > 0 && (
              <button type="button" onClick={() => onChange(new Set())}
                className="w-full px-3 py-2 text-[11px] font-medium text-[var(--text-muted)] hover:text-[var(--accent)] border-t border-[var(--border)] transition-colors duration-150 cursor-pointer">
                Limpar</button>)}
          </div>
        </div>)}
    </div>
  );
}
