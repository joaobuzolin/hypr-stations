import { useState, useEffect } from 'react';
import { OPERADORA_COLORS } from '../../lib/constants';

interface Props {
  viewMode: string;
  opCounts: Record<string, number>;
  /** Whether the bottom SelectionBar is visible; lifts the legend above it. */
  hasSelectionBar?: boolean;
}

const LS_KEY = 'hypr-cell-legend-open';

export default function CellLegend({ viewMode, opCounts, hasSelectionBar = false }: Props) {
  const [open, setOpen] = useState(() => {
    if (typeof window === 'undefined') return true;
    const v = localStorage.getItem(LS_KEY);
    return v === null ? true : v === '1';
  });

  useEffect(() => {
    localStorage.setItem(LS_KEY, open ? '1' : '0');
  }, [open]);

  if (viewMode === 'dominance') return null;

  const sorted = Object.entries(opCounts).sort((a, b) => b[1] - a[1]).slice(0, 8);
  const totalCount = sorted.reduce((acc, [, n]) => acc + n, 0);
  const isHeatmap = viewMode === 'heatmap';

  return (
    <div
      className="absolute right-3.5 z-10 rounded-[10px] overflow-hidden transition-[bottom] duration-200"
      style={{
        bottom: hasSelectionBar ? 84 : 14,
        background: 'var(--bg-surface)',
        border: '0.5px solid var(--border-hover)',
        boxShadow: '0 2px 4px rgba(0, 0, 0, 0.04), 0 8px 24px rgba(0, 0, 0, 0.08)',
        minWidth: open ? 170 : 'auto',
      }}
    >
      {/* Header — clickable to toggle */}
      <button
        type="button"
        onClick={() => setOpen(!open)}
        aria-expanded={open}
        aria-controls="cell-legend-body"
        aria-label={open ? 'Minimizar legenda' : 'Expandir legenda'}
        className="w-full flex items-center gap-2 px-4 py-[10px] cursor-pointer bg-transparent border-0 outline-none
                   hover:bg-[var(--hover-bg)] transition-colors duration-150
                   focus-visible:ring-1 focus-visible:ring-inset focus-visible:ring-[var(--accent)]"
      >
        <span className="text-[11px] font-medium tracking-[0.03em] text-[var(--text-muted)]">
          {isHeatmap ? 'Densidade' : 'Operadoras'}
        </span>
        {!open && !isHeatmap && (
          <span className="text-[11px] text-[var(--text-faint)]">
            {sorted.length} · {totalCount.toLocaleString('pt-BR')}
          </span>
        )}
        <svg
          width="10"
          height="6"
          viewBox="0 0 10 6"
          fill="none"
          stroke="var(--text-faint)"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          className={`ml-auto shrink-0 transition-transform duration-200 ${open ? 'rotate-180' : ''}`}
          aria-hidden="true"
        >
          <path d="M1 1l4 4 4-4" />
        </svg>
      </button>

      {open && (
        <div id="cell-legend-body" className="px-4 pb-3">
          {isHeatmap ? (
            <>
              <div className="flex items-center gap-1 mb-1">
                <div
                  className="h-[3px] flex-1 rounded-full"
                  style={{
                    background:
                      'linear-gradient(to right, rgba(33,102,172,0.4), rgba(51,151,185,0.6), rgba(102,194,165,0.7), rgba(237,217,0,0.8), rgba(245,39,43,0.85))',
                  }}
                />
              </div>
              <div className="flex justify-between text-[11px] text-[var(--text-muted)]">
                <span>Baixa</span><span>Alta</span>
              </div>
            </>
          ) : (
            sorted.map(([op, n]) => (
              <div
                key={op}
                className="flex items-center gap-2 text-[12px] text-[var(--text-primary)] mb-1.5 last:mb-0"
              >
                <span
                  className="w-[7px] h-[7px] rounded-full shrink-0"
                  style={{ background: OPERADORA_COLORS[op] || OPERADORA_COLORS['Outras'] }}
                  aria-hidden="true"
                />
                {op} <span className="text-[var(--text-muted)]">— {n.toLocaleString('pt-BR')}</span>
              </div>
            ))
          )}
          <div className="text-[11px] text-[var(--text-faint)] mt-2.5 pt-2 border-t-[0.5px] border-[var(--border)]">
            Anatel · Fev/2026
          </div>
        </div>
      )}
    </div>
  );
}
