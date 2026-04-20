import { usePresence } from '../shared/hooks/usePresence';

interface HexSelectionBarProps {
  /** Number of hexes currently selected */
  count: number;
  /** Total ERBs aggregated across all selected hexes */
  erbsCount: number;
  /** População residente total na área selecionada (IBGE 2022, dedup aplicado) */
  populationText: string;
  /** Devices endereçáveis estimados (DSP 30d) */
  addressableText: string;
  /** Bottom offset in pixels — used to sit above the main SelectionBar
   *  when the cart is active */
  bottomOffset: number;
  onAddAll: () => void;
  onClear: () => void;
}

const ANIM_MS = 220;

/**
 * Floating pill that appears above the map when the user has multi-selected
 * hexes via shift+click (or shift+drag once that's implemented). Distinct
 * from the main SelectionBar — this one represents "staged for review",
 * the main bar represents "in the plan/cart". Two-step flow: select
 * regions, review aggregated totals, then commit to the plan.
 *
 * Uses the same accent teal as the selection outline in the map so the
 * visual link between "that glowing hex on the map" and "this bar" is
 * immediate.
 */
export default function HexSelectionBar({
  count, erbsCount, populationText, addressableText, bottomOffset, onAddAll, onClear,
}: HexSelectionBarProps) {
  const { mounted, visible } = usePresence(count > 0, ANIM_MS);
  if (!mounted) return null;

  const label = count === 1 ? 'região selecionada' : 'regiões selecionadas';

  return (
    <div
      role="status"
      aria-live="polite"
      style={{
        position: 'absolute',
        left: '50%',
        bottom: bottomOffset + 16,
        transform: `translate(-50%, ${visible ? 0 : 8}px)`,
        opacity: visible ? 1 : 0,
        transition: `opacity ${ANIM_MS}ms ease, transform ${ANIM_MS}ms ease`,
        zIndex: 40,
        pointerEvents: 'auto',
      }}
    >
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: 14,
        padding: '10px 14px 10px 18px',
        background: 'var(--bg-elev)',
        border: '0.5px solid var(--border)',
        borderRadius: 14,
        boxShadow: '0 8px 32px rgba(0, 0, 0, 0.35)',
        backdropFilter: 'blur(8px)',
        WebkitBackdropFilter: 'blur(8px)',
        fontSize: 13,
        fontFamily: 'Urbanist, sans-serif',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{
            width: 8, height: 8, borderRadius: '50%',
            background: 'var(--accent)',
            boxShadow: '0 0 8px var(--accent)',
          }} />
          <span style={{ color: 'var(--text-primary)', fontWeight: 600 }}>
            {count} {label}
          </span>
        </div>

        <div style={{
          width: 0.5, height: 18,
          background: 'var(--border)',
        }} />

        <div style={{ display: 'flex', alignItems: 'center', gap: 14, color: 'var(--text-muted)' }}>
          <span>
            <strong style={{ color: 'var(--text-primary)', fontWeight: 600 }}>
              {erbsCount.toLocaleString('pt-BR')}
            </strong> ERBs
          </span>
          <span>
            <strong style={{ color: 'var(--text-primary)', fontWeight: 600 }}>
              {populationText}
            </strong> pessoas
          </span>
          <span style={{ color: 'var(--text-faint)' }}>→</span>
          <span>
            <strong style={{ color: 'var(--accent)', fontWeight: 600 }}>
              {addressableText}
            </strong> devices
          </span>
        </div>

        <button
          type="button"
          onClick={onClear}
          style={{
            padding: '6px 10px',
            fontSize: 12,
            fontWeight: 500,
            fontFamily: 'Urbanist, sans-serif',
            background: 'transparent',
            color: 'var(--text-muted)',
            border: '0.5px solid var(--border)',
            borderRadius: 8,
            cursor: 'pointer',
            transition: 'all 0.15s',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.color = 'var(--text-primary)';
            e.currentTarget.style.borderColor = 'var(--border-strong, var(--text-muted))';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.color = 'var(--text-muted)';
            e.currentTarget.style.borderColor = 'var(--border)';
          }}
        >
          Limpar
        </button>

        <button
          type="button"
          onClick={onAddAll}
          disabled={erbsCount === 0}
          style={{
            padding: '7px 14px',
            fontSize: 12,
            fontWeight: 600,
            fontFamily: 'Urbanist, sans-serif',
            background: 'var(--accent)',
            color: 'var(--on-accent)',
            border: 'none',
            borderRadius: 8,
            cursor: erbsCount === 0 ? 'not-allowed' : 'pointer',
            opacity: erbsCount === 0 ? 0.5 : 1,
            transition: 'transform 0.15s, filter 0.15s',
          }}
          onMouseEnter={(e) => {
            if (erbsCount > 0) e.currentTarget.style.filter = 'brightness(1.1)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.filter = 'brightness(1)';
          }}
        >
          Adicionar todas ao plano
        </button>
      </div>
    </div>
  );
}
