import { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import { OPERADORA_COLORS } from '../../lib/constants';
import { getDominanceStats, getOperatorFocusStats, getDominanceHexes, computeHexStatus, getResKeyForZoom } from './analysisLayers';
import type { DominanceOptions, DominanceStatus } from './analysisLayers';

interface Props {
  zoom: number;
  onOptionsChange: (opts: DominanceOptions) => void;
  onAddVisibleToCart?: (opts: DominanceOptions, resKey: string, options: { includeAllOperators: boolean }) => Promise<number>;
  getVisibleErbCount?: (opts: DominanceOptions, resKey: string, options: { includeAllOperators: boolean }) => number;
  /** Whether the bottom SelectionBar is visible (cart non-empty). When true the
   *  panel reserves room above it. Prevents overlap in crowded viewports. */
  hasSelectionBar?: boolean;
}

const TECH_OPTS: { value: 'all' | '5G' | '4G'; label: string }[] = [
  { value: 'all', label: 'Todas' },
  { value: '5G', label: '5G' },
  { value: '4G', label: '4G' },
];

const LS_KEY = 'hypr-cell-dominance-open';

// Status colors — work in both light and dark, derived from accent hue families
const STATUS = {
  wins:      { color: '#5cb87a', bg: 'rgba(92,184,122,0.12)', bgLight: 'rgba(92,184,122,0.06)' },
  contested: { color: '#e88a4a', bg: 'rgba(232,138,74,0.12)', bgLight: 'rgba(232,138,74,0.06)' },
  absent:    { color: '#e85454', bg: 'rgba(232,84,84,0.12)',  bgLight: 'rgba(232,84,84,0.06)' },
};

export default function DominancePanel({ zoom, onOptionsChange, onAddVisibleToCart, getVisibleErbCount, hasSelectionBar = false }: Props) {
  const [open, setOpen] = useState(() => {
    if (typeof window === 'undefined') return true;
    const v = localStorage.getItem(LS_KEY);
    return v === null ? true : v === '1';
  });
  const [techFilter, setTechFilter] = useState<'all' | '5G' | '4G'>('all');
  const [focusOp, setFocusOp] = useState<string | null>(null);
  const [rivalOp, setRivalOp] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<Set<DominanceStatus>>(new Set());
  const [rivalPickerOpen, setRivalPickerOpen] = useState(false);
  const [addState, setAddState] = useState<'idle' | 'adding' | 'success'>('idle');
  const [addedCount, setAddedCount] = useState(0);
  const [includeAllOperators, setIncludeAllOperators] = useState(false);
  const [previewCount, setPreviewCount] = useState<number | null>(null);
  const rivalPickerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    localStorage.setItem(LS_KEY, open ? '1' : '0');
  }, [open]);

  const resKey = getResKeyForZoom(zoom);
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
        resKey,
        { includeAllOperators }
      );
      setAddedCount(n);
      setAddState('success');
      setTimeout(() => setAddState('idle'), 2500);
    } catch {
      setAddState('idle');
    }
  }, [onAddVisibleToCart, addState, techFilter, focusOp, rivalOp, statusFilter, resKey, includeAllOperators]);

  // Preview count — computed asynchronously when filters change.
  // First call on a new resolution takes ~200ms (builds hex->ERB map); subsequent are instant.
  useEffect(() => {
    if (!focusOp || !getVisibleErbCount) { setPreviewCount(null); return; }
    let cancelled = false;
    const t = setTimeout(() => {
      if (cancelled) return;
      try {
        const n = getVisibleErbCount(
          { techFilter, focusOp, rivalOp, statusFilter: Array.from(statusFilter) },
          resKey,
          { includeAllOperators }
        );
        if (!cancelled) setPreviewCount(n);
      } catch {
        if (!cancelled) setPreviewCount(null);
      }
    }, 150);
    return () => { cancelled = true; clearTimeout(t); };
  }, [focusOp, rivalOp, statusFilter, techFilter, resKey, includeAllOperators, getVisibleErbCount]);

  if (!stats.byOperator.length) return null;

  const inPairMode = !!(focusOp && rivalOp);
  const labels = inPairMode
    ? { wins: 'Vence', contested: 'Empate', absent: 'Perde' }
    : { wins: 'Domina', contested: 'Disputa', absent: 'Ausente' };

  const displayCounts = !focusOp
    ? { wins: 0, contested: 0, absent: 0 }
    : (rivalOp && pairCounts)
      ? pairCounts
      : { wins: focusStats?.wins ?? 0, contested: focusStats?.contested ?? 0, absent: focusStats?.absent ?? 0 };

  const STATUS_KEYS: DominanceStatus[] = ['wins', 'contested', 'absent'];
  const hasStatusFilter = statusFilter.size > 0;
  const rivalCandidates = stats.byOperator.filter(o => o.op !== focusOp);

  // Proportional bar calculations
  const totalCount = displayCounts.wins + displayCounts.contested + displayCounts.absent;
  const pctWins = totalCount > 0 ? Math.round((displayCounts.wins / totalCount) * 100) : 0;

  // Panel layout reserves vertical space intelligently:
  //  - top: fixed 80px (below ViewModeSelector)
  //  - bottom: 14px when cart empty, 88px when SelectionBar is visible
  // The outer container is flex-column with a fixed header (toggle button)
  // and a scrollable body — if content exceeds the available height, the
  // action button at the bottom stays visible while the middle scrolls.
  const bottomGap = hasSelectionBar ? 88 : 14;

  return (
    <div
      className="hidden md:flex absolute top-20 right-3.5 z-10 w-[290px] rounded-[12px] overflow-hidden flex-col"
      style={{
        background: 'var(--bg-surface)',
        border: '0.5px solid var(--border-hover)',
        boxShadow: '0 2px 4px rgba(0, 0, 0, 0.04), 0 8px 24px rgba(0, 0, 0, 0.08)',
        maxHeight: `calc(100vh - 80px - ${bottomGap}px)`,
      }}
    >
      {/* Toggle header — click to collapse/expand */}
      <button
        type="button"
        onClick={() => setOpen(!open)}
        aria-expanded={open}
        aria-controls="dom-panel-body"
        aria-label={open ? 'Minimizar painel de dominância' : 'Expandir painel de dominância'}
        className="w-full flex items-center gap-2.5 px-4 py-[11px] cursor-pointer bg-transparent border-0 outline-none
                   hover:bg-[var(--hover-bg)] transition-colors duration-150
                   focus-visible:ring-1 focus-visible:ring-inset focus-visible:ring-[var(--accent)]"
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M21 21H3V3" /><path d="M7 17l4-6 4 3 4-7" />
        </svg>
        <div className="flex-1 text-left min-w-0">
          <div className="text-[11px] font-medium tracking-[0.03em] uppercase text-[var(--text-muted)]">
            Dominância
          </div>
          {focusOp && (
            <div className="text-[12px] font-medium mt-0.5 truncate">
              <span style={{ color: OPERADORA_COLORS[focusOp] }}>{focusOp}</span>
              {rivalOp && (
                <>
                  <span className="text-[var(--text-faint)] mx-1">vs</span>
                  <span style={{ color: OPERADORA_COLORS[rivalOp] }}>{rivalOp}</span>
                </>
              )}
            </div>
          )}
        </div>
        <svg
          width="11"
          height="7"
          viewBox="0 0 10 6"
          fill="none"
          stroke="var(--text-faint)"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
          className={`shrink-0 transition-transform duration-200 ${open ? 'rotate-180' : ''}`}
          aria-hidden="true"
        >
          <path d="M1 1l4 4 4-4" />
        </svg>
      </button>

      {open && (
        <div id="dom-panel-body" className="overflow-y-auto min-h-0" style={{ scrollbarWidth: 'thin' }}>
          {/* Tech filter */}
          <div className="flex gap-1.5 px-3 pb-3 pt-1">
            {TECH_OPTS.map(t => {
              const active = techFilter === t.value;
              return (
                <button
                  key={t.value}
                  onClick={() => handleTechChange(t.value)}
                  aria-pressed={active}
                  className="flex-1 py-[7px] rounded-[8px] text-[12px] font-semibold cursor-pointer
                             transition-all duration-150 border-0 outline-none
                             focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
                  style={active
                    ? { background: 'var(--accent)', color: 'var(--on-accent)' }
                    : { background: 'var(--input-bg)', color: 'var(--text-secondary)' }}
                >
                  {t.label}
                </button>
              );
            })}
          </div>

          {/* Region/ERB counts */}
          <div className="px-4 py-2.5 border-t-[0.5px] border-[var(--border)]">
            <div className="text-[11px] text-[var(--text-muted)]">
              <strong className="text-[var(--text-primary)] font-semibold">{stats.totalHexes.toLocaleString('pt-BR')}</strong> regiões
              <span className="mx-1">·</span>
              <strong className="text-[var(--text-primary)] font-semibold">{stats.totalErbs.toLocaleString('pt-BR')}</strong> ERBs
            </div>
          </div>

          {/* Operator list */}
          <div className="px-2 py-2 flex flex-col gap-[2px] max-h-[240px] overflow-y-auto border-t-[0.5px] border-[var(--border)]">
            {stats.byOperator.map(o => {
              const color = OPERADORA_COLORS[o.op] || OPERADORA_COLORS['Outras'];
              const isFocused = focusOp === o.op;
              return (
                <button
                  key={o.op}
                  onClick={() => handleFocusOp(o.op)}
                  aria-pressed={isFocused}
                  className="flex items-center gap-2.5 px-2.5 py-2 rounded-[8px] cursor-pointer
                             transition-all duration-150 w-full text-left border-0 outline-none
                             hover:bg-[var(--hover-bg)]
                             focus-visible:ring-1 focus-visible:ring-[var(--accent)]"
                  style={{
                    background: isFocused ? `${color}15` : 'transparent',
                    border: isFocused ? `0.5px solid ${color}40` : '0.5px solid transparent',
                  }}
                >
                  <span className="w-2 h-2 rounded-full shrink-0" style={{ background: color }} aria-hidden="true" />
                  <span
                    className="text-[13px] font-medium flex-1 truncate"
                    style={{ color: isFocused ? color : 'var(--text-primary)' }}
                  >
                    {o.op}
                  </span>
                  <span className="text-[11px] text-[var(--text-muted)]">{o.hexCount} reg.</span>
                  <span className="text-[11px] font-semibold" style={{ color }}>{(o.pct * 100).toFixed(1)}%</span>
                </button>
              );
            })}
          </div>

          {/* Rival selector */}
          {focusOp && (
            <div className="px-3.5 py-2.5 relative border-t-[0.5px] border-[var(--border)]" ref={rivalPickerRef}>
              {inPairMode ? (
                <button
                  type="button"
                  onClick={() => handleRivalPick(null)}
                  className="flex items-center gap-2 text-[11px] font-medium cursor-pointer bg-transparent border-0 outline-none p-0
                             text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors"
                  aria-label="Remover comparação com rival"
                >
                  <span>Comparando com <strong style={{ color: OPERADORA_COLORS[rivalOp!] }}>{rivalOp}</strong></span>
                  <span className="text-[14px] leading-none text-[var(--text-faint)]">×</span>
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => setRivalPickerOpen(!rivalPickerOpen)}
                  className="flex items-center gap-1.5 text-[11px] font-medium cursor-pointer bg-transparent border-0 outline-none p-0
                             text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors"
                  aria-expanded={rivalPickerOpen}
                  aria-haspopup="listbox"
                >
                  <span>+ Comparar com…</span>
                  <svg width="9" height="5" viewBox="0 0 8 5" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className={`transition-transform duration-150 ${rivalPickerOpen ? 'rotate-180' : ''}`} aria-hidden="true">
                    <path d="M1 1l3 3 3-3" />
                  </svg>
                </button>
              )}

              {rivalPickerOpen && !inPairMode && (
                <div
                  className="absolute left-3 right-3 top-full mt-1 rounded-[8px] overflow-hidden z-10"
                  style={{
                    background: 'var(--bg-surface)',
                    border: '0.5px solid var(--border-hover)',
                    boxShadow: '0 8px 24px rgba(0,0,0,0.12)',
                  }}
                >
                  <div className="max-h-[180px] overflow-y-auto">
                    {rivalCandidates.map(o => {
                      const color = OPERADORA_COLORS[o.op] || OPERADORA_COLORS['Outras'];
                      return (
                        <button
                          key={o.op}
                          type="button"
                          onClick={() => handleRivalPick(o.op)}
                          className="flex items-center gap-2.5 px-3 py-2 w-full text-left cursor-pointer bg-transparent border-0 outline-none
                                     hover:bg-[var(--hover-bg)] transition-colors duration-150 text-[var(--text-primary)]"
                        >
                          <span className="w-2 h-2 rounded-full shrink-0" style={{ background: color }} />
                          <span className="text-[12px] font-medium flex-1">{o.op}</span>
                          <span className="text-[11px] text-[var(--text-muted)]">{o.hexCount} reg.</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Focus stats — 3 clickable status filters + proportional bar */}
          {focusOp && (
            <div className="px-3.5 py-3.5 border-t-[0.5px] border-[var(--border)]">
              {/* Status boxes */}
              <div className="flex gap-2 mb-3">
                {STATUS_KEYS.map(key => {
                  const active = statusFilter.has(key);
                  const dimmed = hasStatusFilter && !active;
                  const count = displayCounts[key];
                  const cfg = STATUS[key];
                  return (
                    <button
                      key={key}
                      onClick={() => toggleStatus(key)}
                      role="checkbox"
                      aria-checked={active}
                      aria-label={`Filtrar por ${labels[key]}: ${count} regiões`}
                      className="flex-1 rounded-[10px] py-2.5 text-center cursor-pointer border-0 outline-none
                                 transition-all duration-150 focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
                      style={{
                        background: active ? cfg.bg : cfg.bgLight,
                        border: active ? `1px solid ${cfg.color}` : '1px solid transparent',
                        opacity: dimmed ? 0.5 : 1,
                        boxShadow: active ? `0 0 0 2px ${cfg.color}25` : 'none',
                      }}
                    >
                      <div className="text-[20px] font-bold leading-none" style={{ color: cfg.color }}>
                        {count.toLocaleString('pt-BR')}
                      </div>
                      <div className="text-[10px] font-semibold tracking-[0.05em] uppercase mt-1.5 text-[var(--text-muted)]">
                        {labels[key]}
                      </div>
                    </button>
                  );
                })}
              </div>

              {hasStatusFilter && (
                <button
                  type="button"
                  onClick={() => { setStatusFilter(new Set()); emit({ statusFilter: [] }); }}
                  className="text-[11px] font-medium mb-2.5 cursor-pointer bg-transparent border-0 outline-none p-0
                             text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors"
                >
                  Limpar filtro de status
                </button>
              )}

              {/* Proportional stacked bar — replaces decorative gradient */}
              {totalCount > 0 && (
                <div
                  className="flex h-[6px] rounded-full overflow-hidden mb-2"
                  role="img"
                  aria-label={`Distribuição: ${displayCounts.wins} ${labels.wins}, ${displayCounts.contested} ${labels.contested}, ${displayCounts.absent} ${labels.absent}`}
                >
                  <div
                    style={{ width: `${(displayCounts.wins / totalCount) * 100}%`, background: STATUS.wins.color }}
                    className="transition-all duration-300"
                  />
                  <div
                    style={{ width: `${(displayCounts.contested / totalCount) * 100}%`, background: STATUS.contested.color }}
                    className="transition-all duration-300"
                  />
                  <div
                    style={{ width: `${(displayCounts.absent / totalCount) * 100}%`, background: STATUS.absent.color }}
                    className="transition-all duration-300"
                  />
                </div>
              )}

              <div className="text-[12px] text-[var(--text-secondary)]">
                {inPairMode ? (
                  <><strong className="text-[var(--text-primary)] font-semibold">{pctWins}%</strong> de vantagem territorial</>
                ) : (
                  <><strong className="text-[var(--text-primary)] font-semibold">{focusStats?.pctDomination ?? 0}%</strong> de domínio territorial</>
                )}
              </div>
              {!inPairMode && focusStats?.topRival && (
                <div className="text-[12px] mt-1 text-[var(--text-secondary)]">
                  Maior rival: <span style={{ color: OPERADORA_COLORS[focusStats.topRival] || '#7a6e64', fontWeight: 600 }}>{focusStats.topRival}</span>
                </div>
              )}

              {/* Add visible regions to cart */}
              {onAddVisibleToCart && (
                <div className="mt-3.5 flex flex-col gap-2">
                  <button
                    type="button"
                    onClick={handleAddToCart}
                    disabled={addState === 'adding'}
                    aria-label="Adicionar ERBs das regiões visíveis ao plano"
                    className="w-full h-10 rounded-[10px] text-[12px] font-semibold
                               cursor-pointer transition-all duration-200 border-0 outline-none
                               focus-visible:ring-2 focus-visible:ring-[var(--accent)]
                               flex items-center justify-center gap-2 disabled:cursor-not-allowed"
                    style={{
                      background: addState === 'success' ? 'rgba(92,184,122,0.15)' : 'var(--accent)',
                      color: addState === 'success' ? '#5cb87a' : 'var(--on-accent)',
                      border: addState === 'success' ? '0.5px solid rgba(92,184,122,0.4)' : '0',
                    }}
                  >
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
                        {previewCount !== null ? (
                          <>
                            Adicionar {previewCount.toLocaleString('pt-BR')} ERB{previewCount === 1 ? '' : 's'}
                            {!includeAllOperators && focusOp && <> de {focusOp}</>}
                          </>
                        ) : (
                          <>Adicionar ao plano</>
                        )}
                      </>
                    )}
                  </button>

                  {/* Toggle: include all operators within the region */}
                  <label className="flex items-center gap-2 cursor-pointer select-none group">
                    <input
                      type="checkbox"
                      checked={includeAllOperators}
                      onChange={e => setIncludeAllOperators(e.target.checked)}
                      className="sr-only peer"
                    />
                    <span
                      className="w-4 h-4 rounded flex items-center justify-center shrink-0 transition-colors duration-150
                                 peer-focus-visible:ring-2 peer-focus-visible:ring-[var(--accent)]"
                      style={{
                        background: includeAllOperators ? 'var(--accent)' : 'var(--input-bg)',
                        border: includeAllOperators ? 'none' : '1.5px solid var(--control-border)',
                      }}
                      aria-hidden="true"
                    >
                      {includeAllOperators && (
                        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="var(--on-accent)" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                          <polyline points="20 6 9 17 4 12" />
                        </svg>
                      )}
                    </span>
                    <span className="text-[11px] text-[var(--text-secondary)] group-hover:text-[var(--text-primary)] transition-colors">
                      Incluir outras operadoras da região
                    </span>
                  </label>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
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
