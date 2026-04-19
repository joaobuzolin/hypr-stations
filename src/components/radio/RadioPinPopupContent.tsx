import type { RadioStation } from './radioData';
import { RADIO_COLORS } from '../../lib/constants';
import { formatAudience, estimateRadioAudience, estimateRadioRadius, getRadioERP } from '../../lib/audience';

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
  const aud = estimateRadioAudience(s.erp, s.tipo, s.classe, s.uf);
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
      {aud > 0 && (
        <div style={{ background: 'var(--bg-surface2)', borderRadius: 10, padding: 16, textAlign: 'center', margin: '10px 20px' }}>
          <div style={{ fontSize: 11, letterSpacing: '0.02em', color: 'var(--text-muted)' }}>Audiência estimada</div>
          <div style={{ fontWeight: 700, fontSize: 20, color: 'var(--accent)', marginTop: 5, letterSpacing: '-0.01em' }}>
            {formatAudience(aud)} devices
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
        Modelo HYPR: alcance × densidade × penetração × campanha 30d
      </div>
    </div>
  );
}
