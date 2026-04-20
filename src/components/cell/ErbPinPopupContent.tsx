import { type ERB } from './cellData';
import { estimateSingleERB, estimateCellRadius, formatAudience } from '../../lib/audience';
import { OPERADORA_COLORS, TECH_COLORS } from '../../lib/constants';

interface Props {
  erb: ERB;
  inCart: boolean;
  onToggleCart: () => void;
}

export default function ErbPinPopupContent({ erb, inCart, onToggleCart }: Props) {
  const opColor = OPERADORA_COLORS[erb.prestadora_norm] || '#7a6e64';
  const freq = erb.freq_mhz?.[0];
  const radius = estimateCellRadius(erb.tech_principal, freq);
  const breakdown = estimateSingleERB({
    lat: erb.lat,
    lng: erb.lng,
    tech_principal: erb.tech_principal,
    freq_mhz: erb.freq_mhz,
  });

  return (
    <div style={{ minWidth: 280 }}>
      <div style={{ padding: '20px 22px 16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
          <div style={{ width: 8, height: 8, borderRadius: '50%', background: opColor, flexShrink: 0 }} />
          <span style={{ fontWeight: 700, fontSize: 16, color: opColor, letterSpacing: '-0.01em' }}>{erb.prestadora_norm}</span>
          <span style={{ fontSize: 10, color: 'var(--text-faint)', marginLeft: 'auto', fontFamily: 'monospace', letterSpacing: '0.02em' }}>
            {erb.num_estacao}
          </span>
        </div>
        <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-primary)', marginBottom: 12, marginLeft: 18 }}>
          {erb.municipio} — {erb.uf}
        </div>
        <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', marginLeft: 18 }}>
          {erb.tecnologias.map(t => {
            const tc = TECH_COLORS[t] || '#576773';
            return (
              <span
                key={t}
                style={{
                  display: 'inline-flex', alignItems: 'center',
                  padding: '2px 8px', borderRadius: 5,
                  fontSize: 10, fontWeight: 600, letterSpacing: '0.03em',
                  background: `${tc}15`, color: tc, border: `0.5px solid ${tc}25`,
                }}
              >{t}</span>
            );
          })}
        </div>
      </div>

      <div style={{ height: '0.5px', background: 'var(--border)', margin: '0 22px' }} />

      <div style={{ display: 'flex', padding: '14px 22px', gap: 20, flexWrap: 'wrap' }}>
        <div>
          <div style={{ fontSize: 10, letterSpacing: '0.04em', textTransform: 'uppercase', color: 'var(--text-faint)', marginBottom: 4 }}>Alcance</div>
          <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>
            ~{radius < 1 ? radius.toFixed(1) : Math.round(radius)} km
          </div>
        </div>
        <div>
          <div style={{ fontSize: 10, letterSpacing: '0.04em', textTransform: 'uppercase', color: 'var(--text-faint)', marginBottom: 4 }}>Tech</div>
          <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>
            {erb.tech_principal}{freq ? <span style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 500, marginLeft: 5 }}>· {freq} MHz</span> : null}
          </div>
        </div>
        <div>
          <div style={{ fontSize: 10, letterSpacing: '0.04em', textTransform: 'uppercase', color: 'var(--text-faint)', marginBottom: 4 }}>Coordenadas</div>
          <div style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-secondary)', fontFamily: 'monospace' }}>
            {erb.lat.toFixed(4)}, {erb.lng.toFixed(4)}
          </div>
        </div>
      </div>

      {breakdown.population > 0 && (
        <div style={{
          margin: '0 14px 10px', padding: '14px 14px',
          background: 'var(--accent-muted)', border: '0.5px solid var(--border)',
          borderRadius: 10,
        }}>
          <div style={{ fontSize: 10, letterSpacing: '0.04em', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: 10, textAlign: 'center' }}>
            Alcance estimado
          </div>
          <div style={{ display: 'flex', alignItems: 'stretch', gap: 6 }}>
            <FunnelStep label="Pessoas" value={formatAudience(breakdown.population)} />
            <FunnelArrow />
            <FunnelStep label="Smartphones" value={formatAudience(breakdown.smartphones)} />
            <FunnelArrow />
            <FunnelStep label="Endereçáveis" value={formatAudience(breakdown.addressable)} accent />
          </div>
        </div>
      )}

      <div style={{ fontSize: 10, color: 'var(--text-faint)', textAlign: 'center', padding: '0 22px 10px', opacity: 0.6 }}>
        Anatel Fev/2026 · IBGE Censo 2022 · Modelo HYPR
      </div>

      <div style={{ padding: '0 14px 14px' }}>
        <button
          type="button"
          onClick={onToggleCart}
          style={{
            width: '100%', padding: 10, borderRadius: 10,
            fontSize: 12, fontWeight: 600, fontFamily: 'Urbanist, sans-serif',
            cursor: 'pointer', transition: 'all 0.15s',
            border: `0.5px solid ${inCart ? 'var(--color-red-400)' : 'var(--accent)'}`,
            background: inCart ? 'transparent' : 'var(--accent)',
            color: inCart ? 'var(--color-red-400)' : 'var(--on-accent)',
          }}
        >
          {inCart ? 'Remover do plano' : 'Adicionar ao plano'}
        </button>
      </div>
    </div>
  );
}

function FunnelStep({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div style={{ flex: 1, textAlign: 'center' }}>
      <div style={{
        fontSize: 14, fontWeight: 700, letterSpacing: '-0.01em',
        color: accent ? 'var(--accent)' : 'var(--text-primary)',
        lineHeight: 1,
      }}>{value}</div>
      <div style={{
        fontSize: 9, marginTop: 4, letterSpacing: '0.03em', textTransform: 'uppercase',
        color: accent ? 'var(--accent)' : 'var(--text-muted)',
        fontWeight: accent ? 600 : 400,
      }}>{label}</div>
    </div>
  );
}

function FunnelArrow() {
  return <div style={{ display: 'flex', alignItems: 'center', color: 'var(--text-faint)', fontSize: 10 }}>→</div>;
}
