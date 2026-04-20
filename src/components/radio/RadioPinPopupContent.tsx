import type { RadioStation } from './radioData';
import { RADIO_COLORS } from '../../lib/constants';
import {
  formatAudience, estimateSingleRadio, estimateRadioRadius, getRadioERP,
} from '../../lib/audience';

interface Props {
  station: RadioStation;
  inCart: boolean;
  onToggleCart: () => void;
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ padding: '8px 0', borderBottom: '0.5px solid var(--border)' }}>
      <div style={{ fontSize: 11, letterSpacing: '0.02em', color: 'var(--text-muted)', marginBottom: 3 }}>{label}</div>
      <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-primary)' }}>{value}</div>
    </div>
  );
}

export default function RadioPinPopupContent({ station: s, inCart, onToggleCart }: Props) {
  const erp = getRadioERP(s.erp, s.classe);
  const r = Math.round(estimateRadioRadius(erp, s.tipo));
  const breakdown = estimateSingleRadio({
    lat: s.lat, lng: s.lng, erp: s.erp, tipo: s.tipo, classe: s.classe,
  });
  const c = s.tipo === 'FM' ? RADIO_COLORS.fm : RADIO_COLORS.am;
  const u = s.tipo === 'FM' ? 'MHz' : 'kHz';

  return (
    <div style={{ minWidth: 280 }}>
      <div style={{ height: 2, background: c }} />
      <div style={{ padding: '18px 20px 0' }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 4 }}>
          <span style={{ fontWeight: 700, fontSize: 20, color: c }}>{s.frequencia}</span>
          <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{u}</span>
          <span style={{ fontSize: 11, color: 'var(--text-muted)', marginLeft: 'auto' }}>{s._fantasy || s.tipo}</span>
        </div>
        <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 10 }}>
          {s.municipio} — {s.uf}
        </div>
      </div>
      <div style={{ padding: '0 20px' }}>
        <Row label="Entidade" value={s.entidade || '—'} />
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr' }}>
          <Row label="Classe" value={s.classe || '—'} />
          <Row label="Categoria" value={s.categoria || '—'} />
          <Row label="ERP / Alcance" value={`${erp.toLocaleString('pt-BR')} W (~${r} km)`} />
          <Row label="Finalidade" value={s.finalidade || '—'} />
          <Row label="Caráter" value={s.carater || '—'} />
          <div />
        </div>
      </div>
      {breakdown.population > 0 && (
        <div style={{
          background: 'var(--bg-surface2)', borderRadius: 10,
          padding: 14, margin: '10px 20px',
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
      <div style={{ padding: '0 20px 14px' }}>
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
      <div style={{ fontSize: 11, color: 'var(--text-muted)', textAlign: 'center', margin: '0 20px 14px', opacity: 0.5 }}>
        Anatel · IBGE Censo 2022 · Modelo HYPR
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
