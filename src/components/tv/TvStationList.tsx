import { memo, useEffect, useRef, useState } from 'react';
import { List, useListRef } from 'react-window';
import { TV_NETWORK_COLORS, TV_NETWORK_NAMES } from '../../lib/constants';
import type { TvStation } from './tvData';

interface Props {
  stations: TvStation[];
  cart: Set<number>;
  activeIdx: number | null;
  onFocus: (i: number) => void;
  onToggleCart: (sid: number) => void;
  onClearCart: () => void;
  onSelectAll: () => void;
  totalCount: number;
}

interface RowData {
  stations: TvStation[];
  cart: Set<number>;
  activeIdx: number | null;
  justAddedSid: number | null;
  onFocus: (i: number) => void;
  onToggleCart: (sid: number) => void;
}

const ROW_HEIGHT = 84;

const TvStationRow = memo(function TvStationRow({
  index, style, ariaAttributes, stations, cart, activeIdx, justAddedSid, onFocus, onToggleCart,
}: { index: number; style: React.CSSProperties; ariaAttributes: Record<string, unknown> } & RowData) {
  const s = stations[index];
  if (!s) return null;

  const sel = cart.has(s._sid);
  const act = activeIdx === index;
  const pulse = justAddedSid === s._sid;
  const networkColor = TV_NETWORK_COLORS[s.rede_id] || TV_NETWORK_COLORS.outras;
  const networkName = TV_NETWORK_NAMES[s.rede_id] || 'Outras';
  const isGenerator = s.tipo === 'TVD';

  return (
    <div style={style} {...ariaAttributes}>
      <div tabIndex={0}
        onClick={() => onFocus(index)}
        onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onFocus(index); } }}
        style={{
          height: ROW_HEIGHT,
          boxSizing: 'border-box',
          animation: pulse ? 'highlightPulse 0.6s cubic-bezier(0.16,1,0.3,1) both' : undefined,
        }}
        className={`relative px-5 py-[12px] cursor-pointer transition-colors duration-150
          outline-none focus-visible:ring-1 focus-visible:ring-inset focus-visible:ring-[var(--accent)]
          ${sel ? 'bg-[var(--accent-muted)]' : act ? 'bg-[var(--bg-surface2)]' : 'hover:bg-[var(--hover-bg)]'}`}>

        <span aria-hidden="true"
          className="absolute left-0 right-0 bottom-0 h-px bg-[var(--border-hover)] pointer-events-none" />

        {sel && (
          <span aria-hidden="true"
            className="absolute left-0 top-0 bottom-0 w-[3px] bg-[var(--accent)] pointer-events-none" />
        )}

        <div className="flex gap-3 items-start">
          <button onClick={e => { e.stopPropagation(); onToggleCart(s._sid); }}
            aria-label={sel ? `Remover ${s.nome_fantasia || s.entidade}` : `Adicionar ${s.nome_fantasia || s.entidade}`}
            className="w-5 h-5 mt-[1px] rounded-md flex items-center justify-center shrink-0 cursor-pointer
              transition-all duration-150 border-0 outline-none"
            style={sel
              ? { background: 'var(--accent)' }
              : { background: 'var(--input-bg)', border: '1.5px solid var(--control-border)' }}>
            {sel && <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="var(--on-accent)" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>}
          </button>

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 leading-none">
              <span
                className="text-[9px] font-bold px-[6px] py-[2px] rounded-[3px] shrink-0 leading-none tracking-[0.03em]"
                style={{
                  background: networkColor + '26',
                  color: networkColor,
                }}
              >
                {networkName.toUpperCase()}
              </span>
              {!isGenerator && (
                <span className="text-[9px] font-medium text-[var(--text-muted)] leading-none">RTV</span>
              )}
              <span className="text-[11px] text-[var(--text-muted)] ml-auto shrink-0 leading-none">
                Ch. {s.canal_virtual || s.canal}
              </span>
            </div>

            <div className="text-[12.5px] font-medium leading-tight truncate mt-[6px] text-[var(--text-primary)]">
              {s.nome_fantasia || s.entidade}
            </div>

            <div className="text-[11px] leading-tight truncate mt-[4px] text-[var(--text-muted)]">
              {s.municipio} — {s.uf}
              {s.erp_kw > 0 && <span className="ml-2">· {s.erp_kw.toLocaleString('pt-BR', { maximumFractionDigits: 1 })} kW</span>}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
});

export default function TvStationList({
  stations, cart, activeIdx, onFocus, onToggleCart, onClearCart, onSelectAll, totalCount,
}: Props) {
  const listRef = useListRef();

  const prevCart = useRef<Set<number>>(cart);
  const [justAddedSid, setJustAddedSid] = useState<number | null>(null);
  useEffect(() => {
    if (cart.size > prevCart.current.size) {
      let added: number | null = null;
      for (const sid of cart) {
        if (!prevCart.current.has(sid)) { added = sid; break; }
      }
      if (added !== null) {
        setJustAddedSid(added);
        const t = window.setTimeout(() => setJustAddedSid(null), 700);
        prevCart.current = new Set(cart);
        return () => window.clearTimeout(t);
      }
    }
    prevCart.current = new Set(cart);
  }, [cart]);

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
          rowComponent={TvStationRow}
          rowProps={{ stations, cart, activeIdx, justAddedSid, onFocus, onToggleCart } satisfies RowData}
          role="list"
          aria-label="Estações de TV"
          style={{ height: '100%' }}
        />
      </div>
      )}
    </div>
  );
}
