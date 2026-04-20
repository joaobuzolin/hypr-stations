import { TV_NETWORK_COLORS, TV_NETWORK_NAMES } from '../../lib/constants';
import type { TvStation } from './tvData';

interface Props {
  station: TvStation;
  onAddToCart?: () => void;
  inCart?: boolean;
}

export default function TvPinPopupContent({ station, onAddToCart, inCart }: Props) {
  const networkColor = TV_NETWORK_COLORS[station.rede_id] || TV_NETWORK_COLORS.outras;
  const networkName = TV_NETWORK_NAMES[station.rede_id] || 'Outras';
  const isGenerator = station.tipo === 'TVD';

  return (
    <div className="flex flex-col gap-2 text-[var(--text-primary)]">
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 mb-1 flex-wrap">
            <span
              className="text-[9px] font-medium px-1.5 py-0.5 rounded"
              style={{
                background: isGenerator ? 'rgba(77, 184, 212, 0.15)' : 'rgba(255, 255, 255, 0.06)',
                color: isGenerator ? 'var(--accent)' : 'var(--text-muted)',
                letterSpacing: '0.04em',
              }}
            >
              {isGenerator ? 'GERADORA' : 'RETRANSMISSORA'}
            </span>
            <span
              className="text-[10px] font-medium px-2 py-0.5 rounded-full"
              style={{
                background: networkColor + '22',
                color: networkColor,
                border: `0.5px solid ${networkColor}55`,
              }}
            >
              {networkName}
            </span>
          </div>
          <div className="text-[13px] font-semibold leading-tight text-[var(--text-primary)]">
            {station.nome_fantasia || station.entidade}
          </div>
          <div className="text-[11px] text-[var(--text-muted)] mt-0.5">
            {station.municipio} · {station.uf}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2 mt-1">
        <div>
          <div className="text-[10px] text-[var(--text-muted)]">Canal</div>
          <div className="text-[12px] font-medium">
            {station.canal_virtual || station.canal}
            {station.canal_virtual && station.canal_virtual !== station.canal && (
              <span className="text-[10px] text-[var(--text-muted)] ml-1">fís. {station.canal}</span>
            )}
          </div>
        </div>
        <div>
          <div className="text-[10px] text-[var(--text-muted)]">ERP</div>
          <div className="text-[12px] font-medium">
            {station.erp_kw > 0 ? `${station.erp_kw.toLocaleString('pt-BR', { maximumFractionDigits: 1 })} kW` : '—'}
          </div>
        </div>
        <div>
          <div className="text-[10px] text-[var(--text-muted)]">Altura</div>
          <div className="text-[12px] font-medium">
            {station.altura_antena > 0 ? `${Math.round(station.altura_antena)} m` : '—'}
          </div>
        </div>
        <div>
          <div className="text-[10px] text-[var(--text-muted)]">Status</div>
          <div className="text-[12px] font-medium">{station.status || '—'}</div>
        </div>
      </div>

      {station.entidade && station.nome_fantasia && station.entidade !== station.nome_fantasia && (
        <div className="pt-1.5 mt-0.5 border-t-[0.5px] border-[var(--border)]">
          <div className="text-[10px] text-[var(--text-muted)]">Entidade outorgada</div>
          <div className="text-[11px] text-[var(--text-secondary)] leading-snug">{station.entidade}</div>
        </div>
      )}

      {onAddToCart && (
        <button
          onClick={onAddToCart}
          className="mt-1.5 w-full py-1.5 text-[11px] font-medium rounded-md
                     transition-colors duration-150 cursor-pointer border-[0.5px]
                     focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:ring-offset-0"
          style={{
            background: inCart ? 'var(--accent-muted)' : 'var(--accent)',
            color: inCart ? 'var(--accent)' : 'var(--on-accent)',
            borderColor: inCart ? 'var(--accent)' : 'transparent',
          }}
        >
          {inCart ? '✓ No briefing' : 'Adicionar ao briefing'}
        </button>
      )}
    </div>
  );
}
