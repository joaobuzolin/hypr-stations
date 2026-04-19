import { useState, useRef, useEffect, useMemo, useId, useLayoutEffect } from 'react';
import { createPortal } from 'react-dom';

interface MultiSelectProps {
  label: string;
  placeholder: string;
  options: string[];
  selected: Set<string>;
  onChange: (s: Set<string>) => void;
  searchable?: boolean;
}

const DROPDOWN_MAX_HEIGHT = 280; // approx: search 44 + list 176 (11rem) + clear 40 + padding
const GAP = 4;

export default function MultiSelect({ label, placeholder, options, selected, onChange, searchable = true }: MultiSelectProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [pos, setPos] = useState<{ top: number; left: number; width: number; flipUp: boolean } | null>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const uid = useId();
  const lid = `ms-${uid}`;

  // Compute position relative to viewport
  const updatePosition = () => {
    if (!triggerRef.current) return;
    const r = triggerRef.current.getBoundingClientRect();
    const spaceBelow = window.innerHeight - r.bottom;
    const spaceAbove = r.top;
    const flipUp = spaceBelow < DROPDOWN_MAX_HEIGHT && spaceAbove > spaceBelow;
    setPos({
      top: flipUp ? r.top - GAP : r.bottom + GAP,
      left: r.left,
      width: r.width,
      flipUp,
    });
  };

  // Position dropdown when it opens + keep it anchored on scroll/resize
  useLayoutEffect(() => {
    if (!open) return;
    updatePosition();
    const onScroll = () => updatePosition();
    const onResize = () => updatePosition();
    window.addEventListener('scroll', onScroll, true);
    window.addEventListener('resize', onResize);
    return () => {
      window.removeEventListener('scroll', onScroll, true);
      window.removeEventListener('resize', onResize);
    };
  }, [open]);

  // Click outside (checks both trigger and portal'd dropdown)
  useEffect(() => {
    if (!open) return;
    const h = (e: MouseEvent) => {
      const t = e.target as Node;
      if (triggerRef.current?.contains(t)) return;
      if (dropdownRef.current?.contains(t)) return;
      setOpen(false);
    };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, [open]);

  // Escape to close
  useEffect(() => {
    if (!open) return;
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape') { setOpen(false); triggerRef.current?.focus(); } };
    document.addEventListener('keydown', h);
    return () => document.removeEventListener('keydown', h);
  }, [open]);

  const filtered = useMemo(() => search ? options.filter(o => o.toLowerCase().includes(search.toLowerCase())) : options, [options, search]);
  const toggle = (v: string) => { const n = new Set(selected); n.has(v) ? n.delete(v) : n.add(v); onChange(n); };

  const dropdown = open && pos && createPortal(
    <div ref={dropdownRef}
      style={{
        position: 'fixed',
        top: pos.flipUp ? undefined : pos.top,
        bottom: pos.flipUp ? window.innerHeight - pos.top : undefined,
        left: pos.left,
        width: pos.width,
        zIndex: 2000,
        background: 'var(--bg-surface)',
        border: '1px solid var(--control-border)',
        borderRadius: 8,
        boxShadow: 'var(--shadow-dropdown)',
        overflow: 'hidden',
      }}>
      {searchable && options.length > 6 && (
        <div className="p-2 border-b border-[var(--border)]">
          <input type="text" value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar..."
            aria-label={`Buscar em ${label}`} autoFocus
            className="w-full px-2.5 py-1.5 rounded text-[12px] text-[var(--text-primary)] placeholder:text-[var(--text-faint)] outline-none focus-visible:ring-1 focus-visible:ring-[var(--accent)] transition-colors box-border"
            style={{ background: 'var(--input-bg)', border: '1px solid var(--input-border-subtle)' }} />
        </div>
      )}
      <div role="listbox" aria-labelledby={lid} className="max-h-44 overflow-y-auto">
        {filtered.map(opt => {
          const on = selected.has(opt);
          return (
            <button key={opt} type="button" role="option" aria-selected={on} onClick={() => toggle(opt)}
              className={`w-full flex items-center gap-2.5 px-3 py-2 text-[12px] text-left transition-colors duration-150 cursor-pointer bg-transparent border-none
                ${on ? 'text-[var(--accent)]' : 'text-[var(--text-secondary)] hover:bg-[var(--hover-bg)]'}`}>
              <span className={`w-3.5 h-3.5 rounded flex items-center justify-center shrink-0 transition-all duration-150
                ${on ? 'bg-[var(--accent)]' : ''}`}
                style={on ? {} : { border: '1px solid var(--control-border)' }}
                aria-hidden="true">
                {on && <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="var(--on-accent)" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>}
              </span>{opt}
            </button>
          );
        })}
        {!filtered.length && <div className="px-3 py-4 text-[12px] text-[var(--text-faint)] text-center">Nenhum resultado</div>}
      </div>
      {selected.size > 0 && (
        <button type="button" onClick={() => onChange(new Set())}
          className="w-full px-3 py-2 text-[11px] font-medium text-[var(--text-muted)] hover:text-[var(--accent)] border-t border-[var(--border)] transition-colors duration-150 cursor-pointer bg-transparent border-l-0 border-r-0 border-b-0">
          Limpar
        </button>
      )}
    </div>,
    document.body
  );

  return (
    <div className="flex flex-col gap-1.5 min-w-0">
      <label id={lid} className="text-[11px] font-medium tracking-[0.03em] text-[var(--text-muted)]">{label}</label>
      <button ref={triggerRef} type="button" onClick={() => setOpen(!open)} aria-expanded={open} aria-haspopup="listbox" aria-labelledby={lid}
        className={`w-full flex items-center gap-1.5 h-8 px-3 rounded-md box-border border-solid text-left text-[12px] transition-all duration-200 cursor-pointer bg-[var(--input-bg)] border ${open ? 'border-[var(--accent)]' : 'border-[var(--input-border)]'}`}>
        {selected.size === 0
          ? <span className="text-[var(--text-muted)] truncate">{placeholder}</span>
          : <div className="flex flex-wrap gap-1 flex-1 overflow-hidden">
              {[...selected].slice(0, 3).map(v => (
                <span key={v} className="inline-flex items-center gap-0.5 px-2 py-0 rounded text-[11px] font-medium bg-[var(--accent-muted)] text-[var(--accent)]">
                  {v}
                  <span role="button" tabIndex={0} aria-label={`Remover ${v}`} className="cursor-pointer opacity-50 hover:opacity-100 ml-0.5"
                    onClick={e => { e.stopPropagation(); toggle(v); }} onKeyDown={e => { if (e.key === 'Enter') { e.stopPropagation(); toggle(v); } }}>×</span>
                </span>))}
              {selected.size > 3 && <span className="text-[11px] text-[var(--text-muted)]">+{selected.size - 3}</span>}
            </div>}
        <svg width="8" height="5" viewBox="0 0 8 5" aria-hidden="true" className={`shrink-0 ml-auto text-[var(--text-faint)] transition-transform duration-200 ${open ? 'rotate-180' : ''}`}>
          <path d="M0 0l4 5 4-5z" fill="currentColor" /></svg>
      </button>
      {dropdown}
    </div>
  );
}
