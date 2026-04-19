import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { Map as MLMap } from 'maplibre-gl';
import { createPortal } from 'react-dom';

/**
 * React-based map popup, positioned via map.project(). Deliberately does NOT
 * use maplibregl.Popup — that class injects DOM wrappers with their own
 * backgrounds/borders that fight the app's theme tokens. This component
 * renders pure app-themed markup as a child of document.body (portal) and
 * positions itself with absolute coordinates synced to the map on every
 * pan/zoom/move frame.
 *
 * Anchor convention: the `lngLat` point is rendered as a small chevron tip
 * at the bottom-center of the card. The card body grows upward from the tip,
 * anchored at its bottom edge. Matches the visual language of the previous
 * maplibregl.Popup output so muscle memory isn't broken.
 */
export interface MapOverlayPopupProps {
  map: MLMap | null;
  lngLat: [number, number] | null; // [lng, lat]
  onClose: () => void;
  children: React.ReactNode;
  maxWidth?: number;   // default 340
  offset?: number;     // gap between tip and anchor point, px. default 12
  closeOnMapClick?: boolean; // default true
  closeOnEscape?: boolean;   // default true
}

export default function MapOverlayPopup({
  map,
  lngLat,
  onClose,
  children,
  maxWidth = 340,
  offset = 12,
  closeOnMapClick = true,
  closeOnEscape = true,
}: MapOverlayPopupProps) {
  const cardRef = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null);
  const [cardHeight, setCardHeight] = useState(0);

  // Track card height so we can anchor the card above the tip correctly.
  // ResizeObserver fires whenever content (including async images / font
  // swap) changes dimensions.
  useLayoutEffect(() => {
    if (!cardRef.current) return;
    const el = cardRef.current;
    const update = () => setCardHeight(el.offsetHeight);
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, [children]);

  // Sync screen position with the map on every frame.
  useEffect(() => {
    if (!map || !lngLat) { setPos(null); return; }

    const project = () => {
      const p = map.project(lngLat);
      setPos({ x: p.x, y: p.y });
    };
    project();

    map.on('move', project);
    map.on('zoom', project);
    map.on('rotate', project);
    map.on('pitch', project);
    return () => {
      map.off('move', project);
      map.off('zoom', project);
      map.off('rotate', project);
      map.off('pitch', project);
    };
  }, [map, lngLat]);

  // Close on map click elsewhere
  useEffect(() => {
    if (!map || !closeOnMapClick) return;
    const onClick = (ev: any) => {
      // Ignore clicks that originated inside the popup card (buttons, etc.)
      if (cardRef.current?.contains(ev.originalEvent?.target as Node)) return;
      onClose();
    };
    map.on('click', onClick);
    return () => { map.off('click', onClick); };
  }, [map, closeOnMapClick, onClose]);

  // Close on Escape
  useEffect(() => {
    if (!closeOnEscape) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [closeOnEscape, onClose]);

  if (!pos || !lngLat) return null;

  // Card anchored at its bottom edge, sitting `offset` px above the tip.
  // Tip itself is a triangle rendered in the bottom 8px of the card container.
  const TIP_HEIGHT = 8;
  const cardLeft = pos.x;
  const cardBottom = pos.y - offset; // distance from viewport top for the BOTTOM of the card

  return createPortal(
    <div
      style={{
        position: 'fixed',
        left: cardLeft,
        top: cardBottom - cardHeight,
        transform: 'translateX(-50%)',
        zIndex: 1000,
        maxWidth,
        width: 'max-content',
        // Prevent the card from clipping the map when anchor is near edges:
        // browser handles overflow naturally since position is fixed.
        pointerEvents: 'none', // re-enabled on the card itself
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
            top: 10,
            right: 10,
            width: 26,
            height: 26,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'transparent',
            border: 'none',
            borderRadius: 6,
            cursor: 'pointer',
            color: 'var(--text-muted)',
            fontSize: 18,
            lineHeight: 1,
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
        >
          ×
        </button>
        {children}
      </div>

      {/* Tip (chevron pointing down toward the anchor). Uses the same
          --bg-surface background so it's seamless with the card, and a
          subtle shadow underneath so it reads as part of the card. */}
      <div
        style={{
          position: 'absolute',
          left: '50%',
          bottom: -TIP_HEIGHT,
          transform: 'translateX(-50%)',
          width: 16,
          height: TIP_HEIGHT,
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
