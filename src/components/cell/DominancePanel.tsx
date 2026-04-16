import { useMemo } from 'react';
import { OPERADORA_COLORS } from '../../lib/constants';
import type { ERB } from './cellData';
import { computeDominanceStats } from './analysisLayers';

interface Props {
  erbs: ERB[];
  resolution: number;
}

export default function DominancePanel({ erbs, resolution }: Props) {
  const stats = useMemo(() => computeDominanceStats(erbs, resolution), [erbs, resolution]);

  if (!stats.byOperator.length) return null;

  const maxCount = Math.max(...stats.byOperator.map(o => o.count));

  return (
    <div className="absolute top-16 right-3.5 z-10 w-[220px] rounded-[10px] overflow-hidden
                    border-[0.5px] border-[var(--border)] overlay-panel">
      {/* Header */}
      <div className="px-4 py-3 border-b border-[var(--border)]">
        <div className="text-[11px] font-medium tracking-[0.03em] text-[var(--text-muted)]">
          Dominância por região
        </div>
        <div className="text-[11px] text-[var(--text-faint)] mt-1">
          {stats.totalHexes.toLocaleString('pt-BR')} regiões · {stats.totalErbs.toLocaleString('pt-BR')} ERBs
        </div>
      </div>

      {/* Bars */}
      <div className="px-4 py-3 flex flex-col gap-3">
        {stats.byOperator.map(o => {
          const color = OPERADORA_COLORS[o.op] || OPERADORA_COLORS['Outras'];
          const barWidth = maxCount > 0 ? (o.count / maxCount) * 100 : 0;
          return (
            <div key={o.op}>
              <div className="flex items-center justify-between mb-1">
                <div className="flex items-center gap-2">
                  <span className="w-[7px] h-[7px] rounded-full shrink-0" style={{ background: color }} />
                  <span className="text-[12px] font-medium" style={{ color }}>{o.op}</span>
                </div>
                <span className="text-[11px] text-[var(--text-muted)]">{o.hexCount} regiões</span>
              </div>
              <div className="h-[4px] rounded-full bg-[var(--border)] overflow-hidden">
                <div className="h-full rounded-full transition-all duration-500"
                  style={{ width: `${barWidth}%`, background: color }} />
              </div>
              <div className="flex justify-between mt-1">
                <span className="text-[11px] text-[var(--text-muted)]">{o.count.toLocaleString('pt-BR')} ERBs</span>
                <span className="text-[11px] font-medium" style={{ color }}>{(o.pct * 100).toFixed(1)}%</span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Footer */}
      <div className="px-4 py-2 border-t border-[var(--border)]">
        <div className="text-[11px] text-[var(--text-faint)]">
          Hex H3 res {resolution} · Cor = operadora dominante
        </div>
      </div>
    </div>
  );
}
