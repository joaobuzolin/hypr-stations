import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { Map as MLMap } from 'maplibre-gl';
import { createPortal } from 'react-dom';

/**
 * React-based map popup, positioned via map.project(). Deliberately does NOT
 * use maplibregl.Popup — that class injects DOM wrappers with their own
 * backgrounds/borders that fight the app's theme tokens.
 *
 * Positioning: map.project() returns coordinates in the MAP CONTAINER's
 * local coordinate space (origin = top-left of the map canvas). We render
 * the popup via portal to document.body with position:fixed, converting
 * container-local coords to viewport coords by adding the container's
 * bounding rect. This keeps the popup free to escape the map container's
 * overflow:hidden — a pin near the top edge of the map won't have its
 * popup clipped.
 *
 * Close behavior: Escape only. Dismissal via clicking empty map is the
 * caller's job — MapLibre dispatches layer-filtered click handlers before
 * generic click, so a naive auto-close would kill the popup on the same
 * click that opened it.
 */
export interface MapOverlayPopupProps {
  map: MLMap | null;
  lngLat: [number, number] | null; // [lng, lat]
  onClose: () => void;
  children: React.ReactNode;
  maxWidth?: number;   // default 340
  offset?: number;     // gap between tip and anchor point, px. default 12
  closeOnEscape?: boolean;   // default true
}

export default function MapOverlayPopup({
  map,
  lngLat,
  onClose,
  children,
  maxWidth = 340,
  offset = 12,
  closeOnEscape = true,
}: MapOverlayPopupProps) {
  const cardRef = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null);
  const [cardHeight, setCardHeight] = useState<number | null>(null);

  // Reset measured height when the popup opens for a new point.
  useEffect(() => {
    if (lngLat) setCardHeight(null);
  }, [lngLat]);

  // Measure card height synchronously before paint.
  useLayoutEffect(() => {
    if (!cardRef.current) return;
    const el = cardRef.current;
    const update = () => setCardHeight(el.offsetHeight);
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, [children, pos]);

  // Sync screen position with the map on every frame.
  // Convert container-local project() coords to viewport coords by
  // adding the container's bounding rect offset.
  useEffect(() => {
    if (!map || !lngLat) { setPos(null); return; }

    const project = () => {
      const local = map.project(lngLat);
      const rect = map.getContainer().getBoundingClientRect();
      setPos({ x: local.x + rect.left, y: local.y + rect.top });
    };
    project();

    map.on('move', project);
    map.on('zoom', project);
    map.on('rotate', project);
    map.on('pitch', project);
    // Also on window resize/scroll, the container's viewport offset
    // can change even though its content doesn't move. Cheap to refresh.
    window.addEventListener('resize', project);
    window.addEventListener('scroll', project, true);
    return () => {
      map.off('move', project);
      map.off('zoom', project);
      map.off('rotate', project);
      map.off('pitch', project);
      window.removeEventListener('resize', project);
      window.removeEventListener('scroll', project, true);
    };
  }, [map, lngLat]);

  // Close on Escape
  useEffect(() => {
    if (!closeOnEscape) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [closeOnEscape, onClose]);

  if (!map || !pos || !lngLat) return null;

  const TIP_HEIGHT = 8;
  const cardLeft = pos.x;
  const cardBottom = pos.y - offset;
  const measured = cardHeight !== null && cardHeight > 0;
  const topPos = measured ? cardBottom - (cardHeight as number) : cardBottom;

  return createPortal(
    <div
      style={{
        position: 'fixed',
        left: cardLeft,
        top: topPos,
        transform: 'translateX(-50%)',
        zIndex: 1000,
        maxWidth,
        width: 'max-content',
        pointerEvents: 'none',
        visibility: measured ? 'visible' : 'hidden',
      }}
    >
      <div
        ref={cardRef}
        style={{
          pointerEvents: 'auto',
          background: 'var(--bg-surface)',
          color: 'var(--text-primary)',
          borderRadius: 14,
          boxShadow: 'var(--popup-shadow)',
          overflow: 'hidden',
          position: 'relative',
          fontFamily: 'Urbanist, system-ui, sans-serif',
        }}
      >
        <button
          type="button"
          aria-label="Fechar"
          onClick={onClose}
          style={{
            position: 'absolute',
            top: 10, right: 10,
            width: 26, height: 26,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: 'transparent', border: 'none', borderRadius: 6,
            cursor: 'pointer',
            color: 'var(--text-muted)',
            fontSize: 18, lineHeight: 1,
            transition: 'background 0.15s ease, color 0.15s ease',
            zIndex: 2,
          }}
          onMouseEnter={e => {
            (e.currentTarget as HTMLButtonElement).style.background = 'var(--bg-surface2)';
            (e.currentTarget as HTMLButtonElement).style.color = 'var(--text-primary)';
          }}
          onMouseLeave={e => {
            (e.currentTarget as HTMLButtonElement).style.background = 'transparent';
            (e.currentTarget as HTMLButtonElement).style.color = 'var(--text-muted)';
          }}
        >×</button>
        {children}
      </div>

      {/* Tip (chevron pointing down toward the anchor) */}
      <div
        style={{
          position: 'absolute',
          left: '50%', bottom: -TIP_HEIGHT,
          transform: 'translateX(-50%)',
          width: 16, height: TIP_HEIGHT,
          pointerEvents: 'none',
        }}
      >
        <svg width={16} height={TIP_HEIGHT} viewBox="0 0 16 8" style={{ display: 'block' }}>
          <path d="M0 0 L8 8 L16 0 Z" fill="var(--bg-surface)" />
        </svg>
      </div>
    </div>,
    document.body
  );
}
