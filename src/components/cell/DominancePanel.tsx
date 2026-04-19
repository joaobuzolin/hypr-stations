import { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import { OPERADORA_COLORS } from '../../lib/constants';
import { getDominanceStats, getOperatorFocusStats, getDominanceHexes, computeHexStatus } from './analysisLayers';
import type { DominanceOptions, DominanceStatus } from './analysisLayers';

interface Props {
  zoom: number;
  onOptionsChange: (opts: DominanceOptions) => void;
  onAddVisibleToCart?: (opts: DominanceOptions, resKey: string) => Promise<number>;
}

const TECH_OPTS: { value: 'all' | '5G' | '4G'; label: string }[] = [
  { value: 'all', label: 'Todas' },
  { value: '5G', label: '5G' },
  { value: '4G', label: '4G' },
];

function isDark() {
  return !document.documentElement.classList.contains('light');
}

export default function DominancePanel({ zoom, onOptionsChange, onAddVisibleToCart }: Props) {
  const [techFilter, setTechFilter] = useState<'all' | '5G' | '4G'>('all');
  const [focusOp, setFocusOp] = useState<string | null>(null);
  const [rivalOp, setRivalOp] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<Set<DominanceStatus>>(new Set());
  const [rivalPickerOpen, setRivalPickerOpen] = useState(false);
  const [addState, setAddState] = useState<'idle' | 'adding' | 'success'>('idle');
  const [addedCount, setAddedCount] = useState(0);
  const rivalPickerRef = useRef<HTMLDivElement>(null);

  const dark = isDark();
  const bg = dark ? 'rgba(15, 20, 25, 0.97)' : 'rgba(255, 255, 255, 0.97)';
  const textPrimary = dark ? '#e8ecf0' : '#1a2530';
  const textSecondary = dark ? '#8899a6' : '#576773';
  const textFaint = dark ? '#3d4d58' : '#c5cdd6';
  const border = dark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.08)';
  const pillBg = dark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.04)';
  const hoverBg = dark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.03)';
  const shadow = dark ? '0 8px 32px rgba(0,0,0,0.4)' : '0 8px 24px rgba(0,0,0,0.1)';

  const resKey = zoom < 6 ? 'r3' : zoom < 8 ? 'r4' : 'r5';
  const stats = useMemo(() => getDominanceStats(techFilter, resKey), [techFilter, resKey]);
  const focusStats = useMemo(() => focusOp ? getOperatorFocusStats(focusOp, techFilter, resKey) : null, [focusOp, techFilter, resKey]);
  const pairCounts = useMemo(
    () => focusOp && rivalOp ? getPairFocusCounts(focusOp, rivalOp, techFilter, resKey) : null,
    [focusOp, rivalOp, techFilter, resKey]
  );

  // Close rival picker on outside click
  useEffect(() => {
    if (!rivalPickerOpen) return;
    const h = (e: MouseEvent) => {
      if (!rivalPickerRef.current?.contains(e.target as Node)) setRivalPickerOpen(false);
    };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, [rivalPickerOpen]);

  const emit = useCallback((overrides: Partial<DominanceOptions> = {}) => {
    onOptionsChange({
      techFilter,
      focusOp,
      rivalOp,
      statusFilter: Array.from(statusFilter),
      ...overrides,
    });
  }, [techFilter, focusOp, rivalOp, statusFilter, onOptionsChange]);

  const handleTechChange = useCallback((t: 'all' | '5G' | '4G') => {
    setTechFilter(t);
    emit({ techFilter: t });
  }, [emit]);

  const handleFocusOp = useCallback((op: string) => {
    const next = focusOp === op ? null : op;
    setFocusOp(next);
    setStatusFilter(new Set());
    // Clear rival if it equals the new focus
    const nextRival = next === rivalOp ? null : rivalOp;
    if (nextRival !== rivalOp) setRivalOp(nextRival);
    if (!next) setRivalOp(null);
    emit({ focusOp: next, statusFilter: [], rivalOp: next ? nextRival : null });
  }, [focusOp, rivalOp, emit]);

  const handleRivalPick = useCallback((op: string | null) => {
    setRivalOp(op);
    setRivalPickerOpen(false);
    emit({ rivalOp: op });
  }, [emit]);

  const toggleStatus = useCallback((s: DominanceStatus) => {
    const n = new Set(statusFilter);
    n.has(s) ? n.delete(s) : n.add(s);
    setStatusFilter(n);
    emit({ statusFilter: Array.from(n) });
  }, [statusFilter, emit]);

  const handleAddToCart = useCallback(async () => {
    if (!onAddVisibleToCart || addState === 'adding') return;
    setAddState('adding');
    try {
      const n = await onAddVisibleToCart(
        { techFilter, focusOp, rivalOp, statusFilter: Array.from(statusFilter) },
        resKey
      );
      setAddedCount(n);
      setAddState('success');
      setTimeout(() => setAddState('idle'), 2500);
    } catch {
      setAddState('idle');
    }
  }, [onAddVisibleToCart, addState, techFilter, focusOp, rivalOp, statusFilter, resKey]);

  if (!stats.byOperator.length) return null;

  // Compute pair counts on demand (iterate stats.byOperator is not enough — we need hex-level classification)
  // Uses the same computeHexStatus that the layer uses, giving consistent results.
  const displayCounts = (() => {
    if (!focusOp) return { wins: 0, contested: 0, absent: 0 };
    if (!rivalOp || !pairCounts) {
      return {
        wins: focusStats?.wins ?? 0,
        contested: focusStats?.contested ?? 0,
        absent: focusStats?.absent ?? 0,
      };
    }
    return pairCounts;
  })();

  const inPairMode = !!(focusOp && rivalOp);
  const labels = inPairMode
    ? { wins: 'Vence', contested: 'Empate', absent: 'Perde' }
    : { wins: 'Domina', contested: 'Disputa', absent: 'Ausente' };

  const STATUS_CONFIG: { key: DominanceStatus; color: string; bgColor: string }[] = [
    { key: 'wins', color: '#5cb87a', bgColor: 'rgba(92,184,122,0.1)' },
    { key: 'contested', color: '#e88a4a', bgColor: 'rgba(232,138,74,0.1)' },
    { key: 'absent', color: '#e85454', bgColor: 'rgba(232,84,84,0.1)' },
  ];

  const hasStatusFilter = statusFilter.size > 0;
  const rivalCandidates = stats.byOperator.filter(o => o.op !== focusOp);

  return (
    <div className="absolute top-16 right-3.5 z-10 w-[260px] rounded-[12px] overflow-hidden"
      style={{ background: bg, boxShadow: shadow, border: `0.5px solid ${border}` }}>

      {/* Tech filter */}
      <div className="flex gap-1.5 p-2.5" style={{ borderBottom: `0.5px solid ${border}` }}>
        {TECH_OPTS.map(t => (
          <button key={t.value} onClick={() => handleTechChange(t.value)}
            className="flex-1 py-[6px] rounded-[7px] text-[11px] font-semibold cursor-pointer transition-all duration-150 border-0 outline-none focus-visible:ring-1 focus-visible:ring-[var(--accent)]"
            style={techFilter === t.value
              ? { background: '#4db8d4', color: dark ? '#000' : '#fff' }
              : { background: pillBg, color: textSecondary }}>
            {t.label}
          </button>
        ))}
      </div>

      {/* Header — shows focus + rival when in pair mode */}
      <div className="px-3.5 py-2.5" style={{ borderBottom: `0.5px solid ${border}` }}>
        <div className="text-[10px] tracking-[0.04em] uppercase" style={{ color: textFaint }}>
          {focusOp ? (
            inPairMode ? (
              <span>
                <span style={{ color: OPERADORA_COLORS[focusOp] }}>{focusOp}</span>
                <span style={{ color: textFaint }}> vs </span>
                <span style={{ color: OPERADORA_COLORS[rivalOp!] }}>{rivalOp}</span>
              </span>
            ) : `Foco: ${focusOp}`
          ) : 'Dominância por região'}
        </div>
        <div className="text-[11px] mt-0.5" style={{ color: textSecondary }}>
          {stats.totalHexes.toLocaleString('pt-BR')} regiões · {stats.totalErbs.toLocaleString('pt-BR')} ERBs
        </div>
      </div>

      {/* Operator list */}
      <div className="px-2 py-2 flex flex-col gap-0.5 max-h-[240px] overflow-y-auto">
        {stats.byOperator.map(o => {
          const color = OPERADORA_COLORS[o.op] || OPERADORA_COLORS['Outras'];
          const isFocused = focusOp === o.op;
          return (
            <button key={o.op} onClick={() => handleFocusOp(o.op)}
              className="flex items-center gap-2.5 px-2.5 py-[7px] rounded-[8px] cursor-pointer transition-all duration-150 w-full text-left border-0 outline-none focus-visible:ring-1 focus-visible:ring-[var(--accent)]"
              data-focused={isFocused || undefined}
              style={{
                background: isFocused ? `${color}15` : 'transparent',
                border: isFocused ? `0.5px solid ${color}30` : '0.5px solid transparent',
                '--op-hover': hoverBg,
              } as React.CSSProperties}>
              <span className="w-[7px] h-[7px] rounded-full shrink-0" style={{ background: color }} />
              <span className="text-[12px] font-medium flex-1" style={{ color: isFocused ? color : textPrimary }}>
                {o.op}
              </span>
              <span className="text-[10px]" style={{ color: textFaint }}>{o.hexCount} reg.</span>
              <span className="text-[10px] font-semibold" style={{ color }}>{(o.pct * 100).toFixed(1)}%</span>
            </button>
          );
        })}
      </div>

      {/* Rival selector — visible when focus is set */}
      {focusOp && (
        <div className="px-3 py-2.5 relative" style={{ borderTop: `0.5px solid ${border}` }} ref={rivalPickerRef}>
          {inPairMode ? (
            <button
              type="button"
              onClick={() => handleRivalPick(null)}
              className="flex items-center gap-2 text-[11px] font-medium cursor-pointer bg-transparent border-0 outline-none p-0 hover:opacity-70 transition-opacity"
              style={{ color: textSecondary }}
              aria-label="Remover comparação com rival">
              <span>Comparando com <strong style={{ color: OPERADORA_COLORS[rivalOp!] }}>{rivalOp}</strong></span>
              <span className="text-[var(--text-faint)]" style={{ color: textFaint, fontSize: 14 }}>×</span>
            </button>
          ) : (
            <button
              type="button"
              onClick={() => setRivalPickerOpen(!rivalPickerOpen)}
              className="flex items-center gap-1.5 text-[11px] font-medium cursor-pointer bg-transparent border-0 outline-none p-0 hover:opacity-70 transition-opacity"
              style={{ color: textSecondary }}
              aria-expanded={rivalPickerOpen}
              aria-haspopup="listbox">
              <span>+ Comparar com…</span>
              <svg width="8" height="5" viewBox="0 0 8 5" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className={`transition-transform duration-150 ${rivalPickerOpen ? 'rotate-180' : ''}`}>
                <path d="M1 1l3 3 3-3" />
              </svg>
            </button>
          )}

          {/* Rival picker dropdown */}
          {rivalPickerOpen && !inPairMode && (
            <div
              className="absolute left-3 right-3 top-full mt-1 rounded-[8px] overflow-hidden z-10"
              style={{
                background: bg,
                border: `0.5px solid ${border}`,
                boxShadow: shadow,
              }}>
              <div className="max-h-[180px] overflow-y-auto">
                {rivalCandidates.map(o => {
                  const color = OPERADORA_COLORS[o.op] || OPERADORA_COLORS['Outras'];
                  return (
                    <button key={o.op} type="button" onClick={() => handleRivalPick(o.op)}
                      className="flex items-center gap-2.5 px-3 py-2 w-full text-left cursor-pointer bg-transparent border-0 outline-none hover:bg-[var(--hover-bg)] transition-colors duration-150"
                      style={{ color: textPrimary }}>
                      <span className="w-[7px] h-[7px] rounded-full shrink-0" style={{ background: color }} />
                      <span className="text-[12px] font-medium flex-1">{o.op}</span>
                      <span className="text-[10px]" style={{ color: textFaint }}>{o.hexCount} reg.</span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Focus stats — 3 clickable status filters */}
      {focusOp && (
        <div className="px-3 py-3" style={{ borderTop: `0.5px solid ${border}` }}>
          <div className="flex gap-1.5 mb-2.5">
            {STATUS_CONFIG.map(s => {
              const active = statusFilter.has(s.key);
              const dimmed = hasStatusFilter && !active;
              const count = displayCounts[s.key];
              return (
                <button key={s.key}
                  onClick={() => toggleStatus(s.key)}
                  role="checkbox"
                  aria-checked={active}
                  aria-label={`Filtrar por ${labels[s.key]}: ${count} regiões`}
                  className="flex-1 rounded-[8px] py-2 text-center cursor-pointer border-0 outline-none
                             transition-all duration-150 focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
                  style={{
                    background: s.bgColor,
                    border: active ? `1px solid ${s.color}` : '1px solid transparent',
                    opacity: dimmed ? 0.4 : 1,
                    boxShadow: active ? `0 0 0 2px ${s.color}20` : 'none',
                  }}>
                  <div className="text-[16px] font-bold leading-none" style={{ color: s.color }}>{count}</div>
                  <div className="text-[9px] tracking-[0.04em] uppercase mt-1" style={{ color: textFaint }}>{labels[s.key]}</div>
                </button>
              );
            })}
          </div>
          {hasStatusFilter && (
            <button
              type="button"
              onClick={() => { setStatusFilter(new Set()); emit({ statusFilter: [] }); }}
              className="text-[10px] font-medium mb-2.5 cursor-pointer bg-transparent border-0 outline-none p-0
                         hover:opacity-70 transition-opacity"
              style={{ color: textSecondary }}>
              Limpar filtro de status
            </button>
          )}
          <div className="text-[11px]" style={{ color: textSecondary }}>
            {inPairMode ? (
              <>
                <strong style={{ color: textPrimary }}>{pctWins(displayCounts)}%</strong> de vantagem territorial
              </>
            ) : (
              <>
                <strong style={{ color: textPrimary }}>{focusStats?.pctDomination ?? 0}%</strong> de domínio territorial
              </>
            )}
          </div>
          {!inPairMode && focusStats?.topRival && (
            <div className="text-[11px] mt-1" style={{ color: textSecondary }}>
              Maior rival: <span style={{ color: OPERADORA_COLORS[focusStats.topRival] || '#7a6e64', fontWeight: 600 }}>{focusStats.topRival}</span>
            </div>
          )}
          <div className="flex items-center gap-1.5 mt-3">
            <span className="text-[9px]" style={{ color: textFaint }}>{inPairMode ? 'Perde' : 'Ausente'}</span>
            <div className="flex-1 h-[4px] rounded-full" style={{
              background: 'linear-gradient(to right, #e85454, #e88a4a, transparent, #5cb87a)'
            }} />
            <span className="text-[9px]" style={{ color: textFaint }}>{inPairMode ? 'Vence' : 'Domina'}</span>
          </div>

          {/* Add visible regions to cart */}
          {onAddVisibleToCart && (
            <button
              type="button"
              onClick={handleAddToCart}
              disabled={addState === 'adding'}
              aria-label="Adicionar ERBs das regiões visíveis ao plano"
              className="w-full mt-3 h-9 rounded-[8px] text-[12px] font-semibold
                         cursor-pointer transition-all duration-200 border-0 outline-none
                         focus-visible:ring-2 focus-visible:ring-[var(--accent)]
                         flex items-center justify-center gap-2 disabled:cursor-not-allowed"
              style={{
                background: addState === 'success' ? 'rgba(92,184,122,0.15)' : 'var(--accent)',
                color: addState === 'success' ? '#5cb87a' : 'var(--on-accent)',
                border: addState === 'success' ? '0.5px solid rgba(92,184,122,0.4)' : '0',
              }}>
              {addState === 'adding' && (
                <>
                  <div className="w-3 h-3 rounded-full border-2 border-current border-t-transparent animate-spin" />
                  Adicionando…
                </>
              )}
              {addState === 'success' && (
                <>
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                  +{addedCount.toLocaleString('pt-BR')} ERBs no plano
                </>
              )}
              {addState === 'idle' && (
                <>
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
                  </svg>
                  Adicionar ao plano
                </>
              )}
            </button>
          )}
        </div>
      )}

      {!focusOp && (
        <div className="px-3.5 py-2" style={{ borderTop: `0.5px solid ${border}` }}>
          <div className="text-[10px]" style={{ color: textFaint }}>
            Clique numa operadora para análise comparativa
          </div>
        </div>
      )}
    </div>
  );
}

function pctWins(counts: { wins: number; contested: number; absent: number }): number {
  const total = counts.wins + counts.contested + counts.absent;
  return total > 0 ? Math.round((counts.wins / total) * 100) : 0;
}

function getPairFocusCounts(
  focusOp: string,
  rivalOp: string,
  techFilter: 'all' | '5G' | '4G',
  resKey: string
): { wins: number; contested: number; absent: number } {
  const hexes = getDominanceHexes(techFilter, resKey);
  let wins = 0, contested = 0, absent = 0;
  for (const h of hexes) {
    const s = computeHexStatus(h, focusOp, rivalOp);
    if (s === 'wins') wins++;
    else if (s === 'contested') contested++;
    else absent++;
  }
  return { wins, contested, absent };
}
