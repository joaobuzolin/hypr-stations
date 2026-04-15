import { RADIO_COLORS } from '../../lib/constants';
import { formatAudience, estimateRadioAudience } from '../../lib/audience';
import type { RadioStation } from './radioData';

interface StationListProps {
  stations: RadioStation[];
  cart: Set<number>;
  activeIdx: number | null;
  onFocus: (idx: number) => void;
  onToggleCart: (sid: number) => void;
  onClearCart: () => void;
  onSelectAll: () => void;
  totalCount: number;
}

export default function StationList({
  stations,
  cart,
  activeIdx,
  onFocus,
  onToggleCart,
  onClearCart,
  onSelectAll,
  totalCount,
}: StationListProps) {
  return (
    <div className="flex flex-col flex-1 overflow-hidden">
      <div className="flex items-center justify-between px-5 py-3 border-b border-[var(--border)]">
        <span className="text-xs text-[var(--text-muted)]">
          Exibindo <strong className="text-[var(--accent)] font-semibold">{totalCount.toLocaleString('pt-BR')}</strong> estações
        </span>
      </div>

      <div className="flex gap-2 px-5 py-3 border-b border-[var(--border)]">
        <button
          onClick={onSelectAll}
          className="flex-1 py-1.5 text-micro font-semibold uppercase tracking-wide
                     bg-[var(--bg-surface2)] border border-[var(--border)] rounded-lg
                     text-[var(--text-muted)] hover:border-[var(--accent)] hover:text-[var(--accent)]
                     transition-colors cursor-pointer"
        >
          Selecionar tudo
        </button>
        <button
          onClick={onClearCart}
          className="flex-1 py-1.5 text-micro font-semibold uppercase tracking-wide
                     bg-[var(--bg-surface2)] border border-[var(--border)] rounded-lg
                     text-[var(--text-muted)] hover:border-[var(--color-red-400)] hover:text-[var(--color-red-400)]
                     transition-colors cursor-pointer"
        >
          Limpar seleção
        </button>
      </div>

      <div className="flex-1 overflow-y-auto" role="list" aria-label="Lista de estações">
        {stations.slice(0, 200).map((s, i) => {
          const isSelected = cart.has(s._sid);
          const isActive = activeIdx === i;
          const aud = estimateRadioAudience(s.erp, s.tipo, s.classe, s.uf);

          return (
            <div
              key={s._sid}
              role="listitem"
              tabIndex={0}
              onClick={() => onFocus(i)}
              onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onFocus(i); } }}
              className={`px-5 py-3 cursor-pointer border-l-2 transition-all duration-100
                          outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:ring-inset
                ${isSelected
                  ? 'bg-[var(--accent-muted)] border-l-[var(--accent)]'
                  : isActive
                    ? 'bg-[var(--bg-surface2)] border-l-[var(--accent)]'
                    : 'border-l-transparent hover:bg-[var(--bg-surface2)] hover:border-l-[var(--accent)]'
                }`}
            >
              <div className="flex items-center gap-2 mb-1">
                <span
                  className="text-micro font-bold px-1.5 py-0.5 rounded-md tracking-wide"
                  style={{
                    background: s.tipo === 'FM' ? RADIO_COLORS.fmBg : RADIO_COLORS.amBg,
                    color: s.tipo === 'FM' ? RADIO_COLORS.fm : RADIO_COLORS.am,
                  }}
                >
                  {s.tipo}
                </span>

                <span className="text-sm font-bold text-[var(--text-primary)]">
                  {s.frequencia} {s.tipo === 'FM' ? 'MHz' : 'kHz'}
                </span>

                {s._fantasy && (
                  <span className="text-xs font-semibold text-[var(--accent)] ml-1 truncate">
                    {s._fantasy}
                  </span>
                )}

                {aud > 0 && (
                  <span className="text-micro font-medium text-[var(--accent)] ml-auto shrink-0">
                    {formatAudience(aud)}
                  </span>
                )}

                <button
                  onClick={(e) => { e.stopPropagation(); onToggleCart(s._sid); }}
                  aria-label={isSelected ? `Remover ${s.frequencia} da seleção` : `Adicionar ${s.frequencia} à seleção`}
                  className={`w-5 h-5 rounded-md border-2 flex items-center justify-center
                              shrink-0 transition-all cursor-pointer
                              ${isSelected
                                ? 'bg-[var(--accent)] border-[var(--accent)]'
                                : 'border-[var(--text-muted)] hover:border-[var(--accent)]'
                              }`}
                >
                  {isSelected ? (
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="var(--on-accent)" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                  ) : (
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
                    </svg>
                  )}
                </button>
              </div>

              <div className="text-xs text-[var(--text-secondary)] truncate">
                {s.municipio} — {s.uf}
              </div>
              <div className="text-micro text-[var(--text-muted)] truncate">
                {s.entidade || ''}
              </div>
            </div>
          );
        })}

        {stations.length > 200 && (
          <div className="px-5 py-5 text-xs text-[var(--text-muted)] text-center">
            Mostrando 200 de {stations.length.toLocaleString('pt-BR')} — use os filtros para refinar
          </div>
        )}
      </div>
    </div>
  );
}
