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
      <div className="flex items-center gap-2 px-5 h-10 border-b border-[var(--border)] shrink-0">
        <span className="text-[12px] text-[var(--text-secondary)]">
          <strong className="text-[var(--accent)] font-semibold">{totalCount.toLocaleString('pt-BR')}</strong> estações
        </span>
        <span className="ml-auto" />
        <button onClick={onSelectAll} className="text-[11px] text-[var(--text-muted)] hover:text-[var(--accent)] cursor-pointer transition-colors font-medium whitespace-nowrap">
          Sel. tudo</button>
        <span className="text-[var(--border-hover)]">·</span>
        <button onClick={onClearCart} className="text-[11px] text-[var(--text-muted)] hover:text-[var(--color-red-400)] cursor-pointer transition-colors whitespace-nowrap">
          Limpar</button>
      </div>

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
              className={`px-5 py-3 cursor-pointer border-l-2 transition-all duration-150
                outline-none focus-visible:ring-1 focus-visible:ring-[var(--accent)] focus-visible:ring-inset
                ${sel ? 'bg-[rgba(77,184,212,0.04)] border-l-[var(--accent)]'
                  : act ? 'bg-[var(--bg-surface2)] border-l-[var(--accent)]'
                  : 'border-l-transparent hover:bg-[rgba(255,255,255,0.02)]'}`}>
              <div className="flex items-center gap-3">
                <button onClick={e => { e.stopPropagation(); onToggleCart(s._sid); }}
                  aria-label={sel ? `Remover ${s.frequencia}` : `Adicionar ${s.frequencia}`}
                  className={`w-4 h-4 rounded-[5px] border-[1.5px] flex items-center justify-center shrink-0 cursor-pointer transition-all duration-150
                    ${sel ? 'bg-[var(--accent)] border-[var(--accent)]' : 'border-[var(--text-faint)] hover:border-[var(--accent)]'}`}>
                  {sel && <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="var(--on-accent)" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>}
                </button>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-[7px] mb-1">
                    <span className="text-[11px] font-semibold px-[9px] py-[3px] rounded-[5px]"
                      style={{ background: isFM ? RADIO_COLORS.fmBg : RADIO_COLORS.amBg, color: isFM ? RADIO_COLORS.fm : RADIO_COLORS.am }}>
                      {s.tipo}
                    </span>
                    <span className="text-[13px] font-semibold text-[var(--text-primary)]">
                      {s.frequencia} <span className="text-[11px] font-normal text-[var(--text-muted)]">{isFM ? 'MHz' : 'kHz'}</span>
                    </span>
                    {aud > 0 && <span className="text-[11px] font-medium text-[var(--accent)] ml-auto shrink-0">{formatAudience(aud)}</span>}
                  </div>
                  <div className="text-[12px] text-[var(--text-secondary)]">{s.municipio} — {s.uf}</div>
                  <div className="text-[11px] text-[var(--text-muted)] mt-0.5 truncate">{s.entidade || ''}</div>
                </div>
              </div>
            </div>
          );
        })}
        {stations.length > 200 && (
          <div className="px-5 py-5 text-[12px] text-[var(--text-muted)] text-center">
            Mostrando 200 de {stations.length.toLocaleString('pt-BR')} — refine com os filtros</div>)}
      </div>
    </div>
  );
}
