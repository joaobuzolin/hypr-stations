import { RADIO_COLORS } from '../../lib/constants';
import { formatAudience, estimateRadioAudience } from '../../lib/audience';
import type { RadioStation } from './radioData';

interface Props {
  stations: RadioStation[]; cart: Set<number>; activeIdx: number | null;
  onFocus: (i: number) => void; onToggleCart: (sid: number) => void;
  onClearCart: () => void; onSelectAll: () => void; totalCount: number;
}

export default function StationList({ stations, cart, activeIdx, onFocus, onToggleCart, onClearCart, onSelectAll, totalCount }: Props) {
  return (
    <div className="flex flex-col flex-1 min-h-0 overflow-hidden">
      {/* Count + actions */}
      <div className="flex items-center gap-2 px-4 h-9 border-b border-[var(--border)] shrink-0">
        <span className="text-[11px] text-[var(--text-muted)]">
          Exibindo <strong className="text-[var(--accent)] font-bold">{totalCount.toLocaleString('pt-BR')}</strong> estações
        </span>
        <span className="ml-auto" />
        <button onClick={onSelectAll} className="text-[10px] text-[var(--text-muted)] hover:text-[var(--accent)] cursor-pointer transition-colors whitespace-nowrap">
          ✓ Selecionar tudo</button>
        <button onClick={onClearCart} className="text-[10px] text-[var(--text-muted)] hover:text-[var(--color-red-400)] cursor-pointer transition-colors whitespace-nowrap">
          ✕ Limpar</button>
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto" role="list" aria-label="Estações">
        {stations.slice(0, 200).map((s, i) => {
          const sel = cart.has(s._sid);
          const act = activeIdx === i;
          const aud = estimateRadioAudience(s.erp, s.tipo, s.classe, s.uf);
          const isFM = s.tipo === 'FM';

          return (
            <div key={s._sid} role="listitem" tabIndex={0}
              onClick={() => onFocus(i)}
              onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onFocus(i); } }}
              className={`px-4 py-2 cursor-pointer border-l-[3px] transition-all duration-100
                outline-none focus-visible:ring-1 focus-visible:ring-[var(--accent)] focus-visible:ring-inset
                ${sel ? 'bg-[var(--accent-muted)] border-l-[var(--accent)]'
                  : act ? 'bg-[var(--bg-surface2)] border-l-[var(--accent)]'
                  : 'border-l-transparent hover:bg-[var(--bg-surface2)]'}`}>
              {/* Row 1: badge + freq + audience + checkbox */}
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded leading-none shrink-0"
                  style={{ background: isFM ? RADIO_COLORS.fmBg : RADIO_COLORS.amBg, color: isFM ? RADIO_COLORS.fm : RADIO_COLORS.am }}>
                  {s.tipo}</span>
                <span className="text-[13px] font-bold text-[var(--text-primary)] leading-none">
                  {s.frequencia} <span className="text-[10px] font-normal text-[var(--text-muted)]">{isFM ? 'MHz' : 'kHz'}</span></span>
                {aud > 0 && <span className="text-[11px] font-semibold text-[var(--accent)] ml-auto shrink-0">{formatAudience(aud)}</span>}
                <button onClick={e => { e.stopPropagation(); onToggleCart(s._sid); }}
                  aria-label={sel ? `Remover ${s.frequencia}` : `Adicionar ${s.frequencia}`}
                  className={`w-[22px] h-[22px] rounded-md border-[1.5px] flex items-center justify-center shrink-0 cursor-pointer transition-all
                    ${sel ? 'bg-[var(--accent)] border-[var(--accent)]' : 'border-[var(--border-hover)] hover:border-[var(--accent)]'}`}>
                  {sel && <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="var(--on-accent)" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><polyline points="20 6 9 17 4 12" /></svg>}
                </button>
              </div>
              {/* Row 2: location */}
              <div className="text-[11px] text-[var(--text-muted)] mt-0.5 truncate">
                {s.municipio} — {s.uf}</div>
              {/* Row 3: entity */}
              <div className="text-[11px] text-[var(--text-muted)] truncate opacity-70">
                {s.entidade || ''}</div>
            </div>
          );
        })}
        {stations.length > 200 && (
          <div className="px-4 py-4 text-[11px] text-[var(--text-muted)] text-center">
            Mostrando 200 de {stations.length.toLocaleString('pt-BR')} — refine com os filtros</div>)}
      </div>
    </div>
  );
}
