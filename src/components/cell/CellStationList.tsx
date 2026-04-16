import { useRef, useCallback } from 'react';
import { List } from 'react-window';
import { OPERADORA_COLORS, TECH_COLORS } from '../../lib/constants';
import type { ERB } from './cellData';

interface Props {
  erbs: ERB[]; cart: Set<number>; activeIdx: number | null;
  onFocus: (i: number) => void; onToggleCart: (id: number) => void;
  onClearCart: () => void; onSelectAll: () => void; totalCount: number;
}

export default function CellStationList({ erbs, cart, activeIdx, onFocus, onToggleCart, onClearCart, onSelectAll, totalCount }: Props) {
  const listRef = useRef<any>(null);

  const Row = useCallback(({ index, style }: { index: number; style: React.CSSProperties }) => {
    const e = erbs[index];
    if (!e) return null;
    const sel = cart.has(e.id);
    const act = activeIdx === index;
    return (
      <div style={style}>
        <div role="listitem" tabIndex={0}
          onClick={() => onFocus(index)}
          onKeyDown={ev => { if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); onFocus(index); } }}
          className={`px-5 py-3 cursor-pointer border-l-2 transition-all duration-150 h-full
            outline-none focus-visible:ring-1 focus-visible:ring-[var(--accent)] focus-visible:ring-inset
            ${sel ? 'bg-[var(--accent-muted)] border-l-[var(--accent)]'
              : act ? 'bg-[var(--bg-surface2)] border-l-[var(--accent)]'
              : 'border-l-transparent hover:bg-[var(--hover-bg)]'}`}>
          <div className="flex items-center gap-3">
            <button onClick={ev => { ev.stopPropagation(); onToggleCart(e.id); }}
              aria-label={sel ? `Remover ${e.prestadora_norm}` : `Adicionar ${e.prestadora_norm}`}
              className={`w-4 h-4 rounded-[5px] border-[1.5px] flex items-center justify-center shrink-0 cursor-pointer transition-all duration-150
                ${sel ? 'bg-[var(--accent)] border-[var(--accent)]' : 'border-[var(--text-faint)] hover:border-[var(--accent)]'}`}>
              {sel && <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="var(--on-accent)" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>}
            </button>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-[7px] mb-1 flex-wrap">
                <span className="text-[12px] font-semibold" style={{ color: OPERADORA_COLORS[e.prestadora_norm] || OPERADORA_COLORS['Outras'] }}>
                  {e.prestadora_norm}
                </span>
                {e.tecnologias.map(t => (
                  <span key={t} className="text-[11px] font-semibold px-2 py-[2px] rounded-[5px]"
                    style={{ color: TECH_COLORS[t] || '#576773', background: (TECH_COLORS[t] || '#576773') + '12' }}>
                    {t}
                  </span>
                ))}
              </div>
              <div className="text-[12px] text-[var(--text-secondary)] truncate">{e.municipio} — {e.uf}</div>
            </div>
          </div>
        </div>
      </div>
    );
  }, [erbs, cart, activeIdx, onFocus, onToggleCart]);

  return (
    <div className="flex flex-col flex-1 min-h-0 overflow-hidden">
      <div className="flex items-center gap-2 px-5 h-10 border-b border-[var(--border)] shrink-0">
        <span className="text-[12px] text-[var(--text-secondary)]">
          <strong className="text-[var(--accent)] font-semibold">{totalCount.toLocaleString('pt-BR')}</strong> ERBs
        </span>
        <span className="ml-auto" />
        <button onClick={onSelectAll} className="text-[11px] text-[var(--text-muted)] hover:text-[var(--accent)] cursor-pointer transition-colors font-medium whitespace-nowrap bg-transparent border-none p-0">
          Sel. tudo</button>
        <span className="text-[var(--border-hover)]">·</span>
        <button onClick={onClearCart} className="text-[11px] text-[var(--text-muted)] hover:text-[var(--color-red-400)] cursor-pointer transition-colors whitespace-nowrap bg-transparent border-none p-0">
          Limpar</button>
      </div>

      <div className="flex-1 min-h-0">
        <List
          ref={listRef}
          height={600}
          width="100%"
          itemCount={erbs.length}
          itemSize={68}
          overscanCount={10}
          style={{ height: '100%' }}
        >
          {Row}
        </List>
      </div>
    </div>
  );
}
