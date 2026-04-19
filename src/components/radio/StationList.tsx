import { memo, useEffect } from 'react';
import { List, useListRef } from 'react-window';
import { formatAudience, estimateRadioAudience } from '../../lib/audience';
import type { RadioStation } from './radioData';

interface Props {
  stations: RadioStation[]; cart: Set<number>; activeIdx: number | null;
  onFocus: (i: number) => void; onToggleCart: (sid: number) => void;
  onClearCart: () => void; onSelectAll: () => void; totalCount: number;
}

interface RowData {
  stations: RadioStation[];
  cart: Set<number>;
  activeIdx: number | null;
  onFocus: (i: number) => void;
  onToggleCart: (sid: number) => void;
}

const ROW_HEIGHT = 88;

const StationRow = memo(function StationRow({
  index, style, ariaAttributes, stations, cart, activeIdx, onFocus, onToggleCart,
}: { index: number; style: React.CSSProperties; ariaAttributes: Record<string, unknown> } & RowData) {
  const s = stations[index];
  if (!s) return null;

  const sel = cart.has(s._sid);
  const act = activeIdx === index;
  const aud = estimateRadioAudience(s.erp, s.tipo, s.classe, s.uf);
  const isFM = s.tipo === 'FM';

  // Badge uses CSS vars that auto-adapt to theme
  const badgeFg = isFM ? 'var(--radio-fm-fg)' : 'var(--radio-am-fg)';
  const badgeBg = isFM ? 'var(--radio-fm-bg)' : 'var(--radio-am-bg)';

  return (
    <div style={style} {...ariaAttributes}>
      <div tabIndex={0}
        onClick={() => onFocus(index)}
        onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onFocus(index); } }}
        style={{ height: ROW_HEIGHT }}
        className={`relative px-5 py-[14px] cursor-pointer transition-colors duration-150
          outline-none focus-visible:ring-1 focus-visible:ring-inset focus-visible:ring-[var(--accent)]
          border-b-[0.5px] border-solid border-[var(--border-hover)]
          ${sel ? 'bg-[var(--accent-muted)]' : act ? 'bg-[var(--bg-surface2)]' : 'hover:bg-[var(--hover-bg)]'}`}>

        {/* Accent bar for selected state */}
        {sel && (
          <span aria-hidden="true"
            className="absolute left-0 top-0 bottom-0 w-[3px] bg-[var(--accent)]" />
        )}

        <div className="flex gap-3 items-start">
          {/* Checkbox */}
          <button onClick={e => { e.stopPropagation(); onToggleCart(s._sid); }}
            aria-label={sel ? `Remover ${s.frequencia}` : `Adicionar ${s.frequencia}`}
            className="w-5 h-5 mt-[1px] rounded-md flex items-center justify-center shrink-0 cursor-pointer
              transition-all duration-150 border-0 outline-none"
            style={sel
              ? { background: 'var(--accent)' }
              : { background: 'var(--input-bg)', border: '1.5px solid var(--control-border)' }}>
            {sel && <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="var(--on-accent)" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>}
          </button>

          {/* Content — 3-line hierarchy */}
          <div className="flex-1 min-w-0">
            {/* Line 1: Type badge + Frequency + audience (right) */}
            <div className="flex items-center gap-2 leading-none">
              <span className="text-[10px] font-bold px-[7px] py-[3px] rounded-[4px] shrink-0 leading-none tracking-[0.03em]"
                style={{ background: badgeBg, color: badgeFg }}>
                {s.tipo}
              </span>
              <span className="text-[13px] font-semibold text-[var(--text-primary)] leading-none tracking-[-0.005em]">
                {s.frequencia}
              </span>
              <span className="text-[11px] text-[var(--text-muted)] leading-none">{isFM ? 'MHz' : 'kHz'}</span>
              {aud > 0 && (
                <span className="text-[11px] font-medium text-[var(--accent)] ml-auto shrink-0 leading-none">
                  {formatAudience(aud)}
                </span>
              )}
            </div>

            {/* Line 2: Município — UF */}
            <div className="text-[12px] leading-tight truncate mt-[7px] text-[var(--text-primary)]">
              {s.municipio} <span className="text-[var(--text-muted)]">— {s.uf}</span>
            </div>

            {/* Line 3: Entidade (optional) */}
            {s.entidade && (
              <div className="text-[11px] leading-tight truncate mt-[4px] text-[var(--text-muted)]">
                {s.entidade}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
});

export default function StationList({ stations, cart, activeIdx, onFocus, onToggleCart, onClearCart, onSelectAll, totalCount }: Props) {
  const listRef = useListRef();

  useEffect(() => {
    if (activeIdx != null && listRef.current) {
      try { listRef.current.scrollToRow({ index: activeIdx, align: 'smart' }); } catch {}
    }
  }, [activeIdx, listRef]);

  return (
    <div className="flex flex-col flex-1 min-h-0 overflow-hidden">
      <div className="flex items-center gap-2 px-5 h-10 border-b border-[var(--border-hover)] shrink-0">
        <span className="text-[12px] text-[var(--text-secondary)]">
          <strong className="text-[var(--accent)] font-semibold">{totalCount.toLocaleString('pt-BR')}</strong> estações
          {cart.size > 0 && <span className="text-[var(--text-muted)]"> · <strong className="text-[var(--text-primary)] font-semibold">{cart.size}</strong> no plano</span>}
        </span>
        <span className="ml-auto" />
        <button onClick={onSelectAll} className="text-[11px] text-[var(--text-muted)] hover:text-[var(--accent)] cursor-pointer transition-colors font-medium whitespace-nowrap bg-transparent border-0 outline-none p-0">
          Sel. tudo</button>
        <span className="text-[var(--border-hover)]">·</span>
        <button onClick={onClearCart} className="text-[11px] text-[var(--text-muted)] hover:text-[var(--color-red-400)] cursor-pointer transition-colors whitespace-nowrap bg-transparent border-0 outline-none p-0">
          Limpar</button>
      </div>

      {stations.length === 0 ? (
        <div className="flex-1 flex items-center justify-center p-8">
          <div className="text-center">
            <p className="text-[13px] text-[var(--text-muted)] mb-2">Nenhuma estação encontrada</p>
            <p className="text-[12px] text-[var(--text-muted)]">Tente ajustar os filtros</p>
          </div>
        </div>
      ) : (
      <div className="flex-1 min-h-0">
        <List
          listRef={listRef}
          rowCount={stations.length}
          rowHeight={ROW_HEIGHT}
          rowComponent={StationRow}
          rowProps={{ stations, cart, activeIdx, onFocus, onToggleCart } satisfies RowData}
          role="list"
          aria-label="Estações"
          style={{ height: '100%' }}
        />
      </div>
      )}
    </div>
  );
}
