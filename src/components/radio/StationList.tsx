import { useCallback } from 'react';
import { RADIO_COLORS } from '../../lib/constants';
import { formatAudience, estimateRadioAudience, getRadioERP } from '../../lib/audience';
import type { RadioStation } from './radioData';

interface StationListProps {
  stations: RadioStation[];
  cart: Set<number>;
  activeIdx: number | null;
  onFocus: (idx: number) => void;
  onToggleCart: (sid: number) => void;
  totalCount: number;
}

export default function StationList({
  stations,
  cart,
  activeIdx,
  onFocus,
  onToggleCart,
  totalCount,
}: StationListProps) {
  return (
    <div className="flex flex-col flex-1 overflow-hidden">
      {/* Count header */}
      <div className="flex items-center justify-between px-5 py-2.5 border-b border-[var(--border)]">
        <span className="text-xs text-[var(--text-muted)]">
          Exibindo <strong className="text-[var(--accent)] font-semibold">{totalCount.toLocaleString('pt-BR')}</strong> estações
        </span>
      </div>

      {/* Selection actions */}
      <div className="flex gap-2 px-5 py-2 border-b border-[var(--border)]">
        <button
          onClick={() => stations.forEach(s => onToggleCart(s._sid))}
          className="flex-1 py-1.5 text-[10px] font-semibold uppercase tracking-wide
                     bg-[var(--bg-surface2)] border border-[var(--border)] rounded-md
                     text-[var(--text-muted)] hover:border-[var(--accent)] hover:text-[var(--accent)]
                     transition-colors cursor-pointer"
        >
          ✓ Selecionar tudo
        </button>
        <button
          onClick={() => {/* handled by parent clearing cart */}}
          className="flex-1 py-1.5 text-[10px] font-semibold uppercase tracking-wide
                     bg-[var(--bg-surface2)] border border-[var(--border)] rounded-md
                     text-red-400 border-red-400/20 hover:border-red-400 hover:text-red-400
                     transition-colors cursor-pointer"
        >
          ✕ Limpar seleção
        </button>
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto">
        {stations.slice(0, 200).map((s, i) => {
          const isSelected = cart.has(s._sid);
          const isActive = activeIdx === i;
          const aud = estimateRadioAudience(s.erp, s.tipo, s.classe, s.uf);

          return (
            <div
              key={s._sid}
              className={`px-5 py-2.5 cursor-pointer border-l-2 transition-all duration-100
                ${isSelected
                  ? 'bg-[var(--accent-muted)] border-l-[var(--accent)]'
                  : isActive
                    ? 'bg-[var(--bg-surface2)] border-l-[var(--accent)]'
                    : 'border-l-transparent hover:bg-[var(--bg-surface2)] hover:border-l-[var(--accent)]'
                }`}
              onClick={() => onFocus(i)}
            >
              <div className="flex items-center gap-2 mb-1">
                {/* Type badge */}
                <span
                  className="text-[9px] font-bold px-1.5 py-0.5 rounded tracking-wide"
                  style={{
                    background: s.tipo === 'FM' ? RADIO_COLORS.fmBg : RADIO_COLORS.amBg,
                    color: s.tipo === 'FM' ? RADIO_COLORS.fm : RADIO_COLORS.am,
                  }}
                >
                  {s.tipo}
                </span>

                {/* Frequency */}
                <span className="text-[13px] font-bold text-[var(--text-primary)]">
                  {s.frequencia} {s.tipo === 'FM' ? 'MHz' : 'kHz'}
                </span>

                {/* Fantasy name */}
                {s._fantasy && (
                  <span className="text-[11px] font-semibold text-[var(--accent)] ml-1">
                    {s._fantasy}
                  </span>
                )}

                {/* Audience */}
                {aud > 0 && (
                  <span className="text-[10px] font-medium text-[var(--accent)] ml-auto">
                    {formatAudience(aud)}
                  </span>
                )}

                {/* Select checkbox */}
                <button
                  onClick={(e) => { e.stopPropagation(); onToggleCart(s._sid); }}
                  className={`w-5 h-5 rounded-md border-2 flex items-center justify-center
                              shrink-0 transition-all cursor-pointer
                              ${isSelected
                                ? 'bg-[var(--accent)] border-[var(--accent)]'
                                : 'border-[var(--text-muted)] opacity-50 hover:opacity-100 hover:border-[var(--accent)]'
                              }`}
                >
                  {isSelected ? (
                    <span className="text-[10px] text-[var(--on-accent)]">✓</span>
                  ) : (
                    <span className="text-[12px] text-[var(--text-muted)]">+</span>
                  )}
                </button>
              </div>

              <div className="text-[11px] text-[var(--text-muted)] truncate">
                {s.municipio} — {s.uf}
              </div>
              <div className="text-[10px] text-[var(--text-muted)] truncate opacity-70">
                {s.entidade || ''}
              </div>
            </div>
          );
        })}

        {stations.length > 200 && (
          <div className="px-5 py-4 text-xs text-[var(--text-muted)] text-center">
            Mostrando 200 de {stations.length.toLocaleString('pt-BR')} — use os filtros para refinar
          </div>
        )}
      </div>
    </div>
  );
}
