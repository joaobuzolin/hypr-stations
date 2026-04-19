import { useState } from 'react';
import { OPERADORA_COLORS } from '../../lib/constants';

export interface HexPopupData {
  h3Id: string;
  dominant: string;
  dominantPct: number;
  total: number;
  status: 'wins' | 'contested' | 'absent' | null;
  opCounts: [string, number][]; // sorted desc by count
  focusOp?: string | null;
  rivalOp?: string | null;
}

interface Props {
  data: HexPopupData;
  showDrill: boolean;
  onDrill: () => void;
  onAddRegion: () => number; // returns count of newly-added ERBs
}

const STATUS_CONFIG: Record<string, { color: string; bg: string; label: string; labelPair: string }> = {
  wins:      { color: '#5cb87a', bg: 'rgba(92,184,122,0.12)',  label: 'Domina',  labelPair: 'Vence' },
  contested: { color: '#e88a4a', bg: 'rgba(232,138,74,0.12)',  label: 'Disputa', labelPair: 'Empate' },
  absent:    { color: '#e85454', bg: 'rgba(232,84,84,0.12)',   label: 'Ausente', labelPair: 'Perde' },
};

export default function HexPopupContent({ data, showDrill, onDrill, onAddRegion }: Props) {
  const [addState, setAddState] = useState<{ done: boolean; added: number }>({ done: false, added: 0 });
  const { h3Id: _h3, dominant, dominantPct, total, status, opCounts, focusOp, rivalOp } = data;
  void _h3;
  const inPairMode = !!(focusOp && rivalOp);

  const statusCfg = status ? STATUS_CONFIG[status] : null;
  const statusLabel = statusCfg ? (inPairMode ? statusCfg.labelPair : statusCfg.label) : null;

  const handleAdd = () => {
    if (addState.done) return;
    const added = onAddRegion();
    setAddState({ done: true, added });
  };

  return (
    <div style={{ minWidth: 280 }}>
      <div style={{ padding: '16px 18px 12px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
          <svg width={12} height={12} viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <polygon points="21 16 21 8 12 3 3 8 3 16 12 21 21 16" />
          </svg>
          <span style={{ fontSize: 10, letterSpacing: '0.04em', textTransform: 'uppercase', color: 'var(--text-muted)', fontWeight: 600 }}>Região</span>
          {statusCfg && statusLabel && (
            <span style={{ marginLeft: 'auto' }}>
              <span style={{
                display: 'inline-flex', alignItems: 'center',
                padding: '2px 8px', borderRadius: 4,
                fontSize: 10, fontWeight: 700, letterSpacing: '0.04em', textTransform: 'uppercase',
                background: statusCfg.bg, color: statusCfg.color,
              }}>
                {statusLabel}
              </span>
            </span>
          )}
        </div>

        <div style={{ fontSize: 13, color: 'var(--text-primary)', marginBottom: 12 }}>
          <strong style={{ fontWeight: 600 }}>{total.toLocaleString('pt-BR')}</strong>
          <span style={{ color: 'var(--text-muted)' }}> ERBs · {dominant} lidera com {dominantPct}%</span>
        </div>

        {inPairMode && (() => {
          const my = opCounts.find(([op]) => op === focusOp)?.[1] || 0;
          const rv = opCounts.find(([op]) => op === rivalOp)?.[1] || 0;
          const focusColor = OPERADORA_COLORS[focusOp!] || '#7a6e64';
          const rivalColor = OPERADORA_COLORS[rivalOp!] || '#7a6e64';
          return (
            <div style={{
              display: 'flex', alignItems: 'center', gap: 8,
              marginBottom: 10, padding: '10px 12px',
              background: 'var(--bg-surface2)', borderRadius: 8, fontSize: 12,
            }}>
              <span style={{ color: focusColor, fontWeight: 700 }}>{focusOp}</span>
              <strong style={{ color: 'var(--text-primary)', fontVariantNumeric: 'tabular-nums' }}>{my}</strong>
              <span style={{ color: 'var(--text-faint)' }}>vs</span>
              <span style={{ color: rivalColor, fontWeight: 700 }}>{rivalOp}</span>
              <strong style={{ color: 'var(--text-primary)', fontVariantNumeric: 'tabular-nums' }}>{rv}</strong>
            </div>
          );
        })()}

        {opCounts.slice(0, 6).map(([op, n]) => {
          const pct = total > 0 ? Math.round((n / total) * 100) : 0;
          const color = OPERADORA_COLORS[op] || OPERADORA_COLORS['Outras'];
          const isFocus = op === focusOp;
          const isRival = op === rivalOp;
          return (
            <div key={op} style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 12, marginBottom: 6 }}>
              <span style={{ display: 'inline-block', width: 6, height: 6, borderRadius: '50%', background: color, flexShrink: 0 }} />
              <span style={{
                fontWeight: isFocus ? 700 : isRival ? 600 : 400,
                color: (isFocus || isRival) ? color : 'var(--text-primary)',
                minWidth: 66,
              }}>{op}</span>
              <div style={{ flex: 1, height: 4, borderRadius: 2, background: 'var(--input-bg)', overflow: 'hidden' }}>
                <div style={{ height: '100%', width: `${pct}%`, background: color }} />
              </div>
              <span style={{ color: 'var(--text-muted)', fontVariantNumeric: 'tabular-nums', minWidth: 58, textAlign: 'right' }}>
                <strong style={{ color: 'var(--text-primary)', fontWeight: 600 }}>{n}</strong> · {pct}%
              </span>
            </div>
          );
        })}
      </div>

      <div style={{ padding: '10px 12px', borderTop: '0.5px solid var(--border)', display: 'flex', gap: 6 }}>
        {showDrill && (
          <button
            type="button"
            onClick={onDrill}
            style={{
              flex: '0 0 auto', padding: '8px 12px', borderRadius: 8,
              fontSize: 11, fontWeight: 600, fontFamily: 'Urbanist, sans-serif',
              cursor: 'pointer', background: 'transparent', color: 'var(--text-secondary)',
              border: '0.5px solid var(--input-border)', transition: 'all 0.15s',
            }}
          >Aproximar</button>
        )}
        <button
          type="button"
          onClick={handleAdd}
          disabled={addState.done}
          style={{
            flex: 1, padding: 8, borderRadius: 8,
            fontSize: 11, fontWeight: 700, fontFamily: 'Urbanist, sans-serif',
            cursor: addState.done ? 'default' : 'pointer',
            background: addState.done ? 'rgba(92,184,122,0.15)' : 'var(--accent)',
            color: addState.done ? '#5cb87a' : 'var(--on-accent)',
            border: addState.done ? '0.5px solid rgba(92,184,122,0.4)' : 0,
            transition: 'all 0.15s',
          }}
        >
          {addState.done
            ? (addState.added > 0 ? `+${addState.added.toLocaleString('pt-BR')} no plano` : 'Já no plano')
            : 'Adicionar esta região'}
        </button>
      </div>
    </div>
  );
}
