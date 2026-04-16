import { useState, useMemo, useCallback } from 'react';
import { OPERADORA_COLORS } from '../../lib/constants';
import { getDominanceStats, getOperatorFocusStats } from './analysisLayers';
import type { DominanceOptions } from './analysisLayers';

interface Props {
  zoom: number;
  onOptionsChange: (opts: DominanceOptions) => void;
}

const TECH_OPTS: { value: 'all' | '5G' | '4G'; label: string }[] = [
  { value: 'all', label: 'Todas' },
  { value: '5G', label: '5G' },
  { value: '4G', label: '4G' },
];

export default function DominancePanel({ zoom, onOptionsChange }: Props) {
  const [techFilter, setTechFilter] = useState<'all' | '5G' | '4G'>('all');
  const [focusOp, setFocusOp] = useState<string | null>(null);

  const resKey = zoom < 6 ? 'r3' : zoom < 8 ? 'r4' : 'r5';
  const stats = useMemo(() => getDominanceStats(techFilter, resKey), [techFilter, resKey]);
  const focusStats = useMemo(() => focusOp ? getOperatorFocusStats(focusOp, techFilter, resKey) : null, [focusOp, techFilter, resKey]);

  const handleTechChange = useCallback((t: 'all' | '5G' | '4G') => {
    setTechFilter(t);
    onOptionsChange({ techFilter: t, focusOp });
  }, [focusOp, onOptionsChange]);

  const handleFocusOp = useCallback((op: string) => {
    const next = focusOp === op ? null : op;
    setFocusOp(next);
    onOptionsChange({ techFilter, focusOp: next });
  }, [focusOp, techFilter, onOptionsChange]);

  if (!stats.byOperator.length) return null;

  return (
    <div className="absolute top-16 right-3.5 z-10 w-[250px] rounded-[12px] overflow-hidden border-[0.5px] border-[var(--border)]"
      style={{ background: 'rgba(15, 20, 25, 0.97)', boxShadow: '0 8px 32px rgba(0,0,0,0.4)' }}>

      {/* Tech filter pills */}
      <div className="flex gap-1.5 p-2.5 border-b border-[var(--border)]">
        {TECH_OPTS.map(t => {
          const on = techFilter === t.value;
          return (
            <button key={t.value} onClick={() => handleTechChange(t.value)}
              className="flex-1 py-[6px] rounded-[7px] text-[11px] font-semibold cursor-pointer transition-all duration-150 border-0 outline-none"
              style={on
                ? { background: '#4db8d4', color: '#000' }
                : { background: 'rgba(255,255,255,0.04)', color: '#576773' }}>
              {t.label}
            </button>
          );
        })}
      </div>

      {/* Header */}
      <div className="px-3.5 py-2.5 border-b border-[var(--border)]">
        <div className="text-[10px] tracking-[0.04em] uppercase" style={{ color: '#3d4d58' }}>
          {focusOp ? `Foco: ${focusOp}` : 'Dominância por região'}
        </div>
        <div className="text-[11px] mt-0.5" style={{ color: '#576773' }}>
          {stats.totalHexes.toLocaleString('pt-BR')} regiões · {stats.totalErbs.toLocaleString('pt-BR')} ERBs
        </div>
      </div>

      {/* Operator list */}
      <div className="px-2 py-2 flex flex-col gap-0.5 max-h-[280px] overflow-y-auto">
        {stats.byOperator.map(o => {
          const color = OPERADORA_COLORS[o.op] || OPERADORA_COLORS['Outras'];
          const isFocused = focusOp === o.op;
          return (
            <button key={o.op} onClick={() => handleFocusOp(o.op)}
              className="flex items-center gap-2.5 px-2.5 py-[7px] rounded-[8px] cursor-pointer transition-all duration-150 w-full text-left border-0 outline-none"
              style={isFocused
                ? { background: `${color}15`, border: `0.5px solid ${color}30` }
                : { background: 'transparent' }}>
              <span className="w-[7px] h-[7px] rounded-full shrink-0" style={{ background: color }} />
              <span className="text-[12px] font-medium flex-1" style={{ color: isFocused ? color : '#e8ecf0' }}>
                {o.op}
              </span>
              <span className="text-[10px]" style={{ color: '#3d4d58' }}>{o.hexCount} reg.</span>
              <span className="text-[10px] font-semibold" style={{ color }}>{(o.pct * 100).toFixed(1)}%</span>
            </button>
          );
        })}
      </div>

      {/* Focus stats */}
      {focusStats && focusOp && (
        <div className="px-3 py-3 border-t border-[var(--border)]">
          <div className="flex gap-2 mb-2.5">
            <div className="flex-1 rounded-[8px] py-2.5 text-center" style={{ background: 'rgba(92,184,122,0.1)' }}>
              <div className="text-[18px] font-bold" style={{ color: '#5cb87a' }}>{focusStats.wins}</div>
              <div className="text-[9px] tracking-[0.04em] uppercase" style={{ color: '#3d4d58' }}>Ganha</div>
            </div>
            <div className="flex-1 rounded-[8px] py-2.5 text-center" style={{ background: 'rgba(232,84,84,0.1)' }}>
              <div className="text-[18px] font-bold" style={{ color: '#e85454' }}>{focusStats.losses}</div>
              <div className="text-[9px] tracking-[0.04em] uppercase" style={{ color: '#3d4d58' }}>Perde</div>
            </div>
          </div>
          <div className="text-[11px]" style={{ color: '#8899a6' }}>
            <strong style={{ color: '#e8ecf0' }}>{focusStats.pctDomination}%</strong> de domínio territorial
          </div>
          {focusStats.topRival && (
            <div className="text-[11px] mt-1" style={{ color: '#576773' }}>
              Maior rival: <span style={{ color: OPERADORA_COLORS[focusStats.topRival] || '#7a6e64', fontWeight: 600 }}>{focusStats.topRival}</span>
            </div>
          )}
          <div className="flex items-center gap-1.5 mt-3">
            <span className="text-[9px]" style={{ color: '#3d4d58' }}>Perde</span>
            <div className="flex-1 h-[4px] rounded-full" style={{
              background: 'linear-gradient(to right, #e85454, rgba(232,84,84,0.15), transparent, rgba(92,184,122,0.15), #5cb87a)'
            }} />
            <span className="text-[9px]" style={{ color: '#3d4d58' }}>Ganha</span>
          </div>
        </div>
      )}

      {/* Footer hint */}
      {!focusOp && (
        <div className="px-3.5 py-2 border-t border-[var(--border)]">
          <div className="text-[10px]" style={{ color: '#3d4d58' }}>
            Clique numa operadora para análise comparativa
          </div>
        </div>
      )}
    </div>
  );
}
