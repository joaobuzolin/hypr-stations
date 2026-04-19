import { useEffect, useLayoutEffect, useRef, useState } from 'react';

interface Props {
  mode: string;
  onChange: (mode: string) => void;
}

const MODES = [
  { value: 'pins', label: 'ERBs', icon: (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="10" r="3"/><path d="M12 2a8 8 0 0 0-8 8c0 5.4 8 12 8 12s8-6.6 8-12a8 8 0 0 0-8-8z"/>
    </svg>
  )},
  { value: 'heatmap', label: 'Heatmap', icon: (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6" opacity="0.6"/><circle cx="12" cy="12" r="2" opacity="0.3"/>
    </svg>
  )},
  { value: 'dominance', label: 'Dominância', icon: (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M21 21H3V3"/><path d="M7 17l4-6 4 3 4-7"/>
    </svg>
  )},
];

/**
 * Segmented control with a sliding pill indicator. The active background
 * is a single absolutely-positioned element that animates its left/width
 * between button positions — feels like iOS/iPadOS segmented controls.
 *
 * Buttons differ in width (the Portuguese "Dominância" is ~1.5× the width
 * of "ERBs"), so we measure each button's offsetLeft/offsetWidth with a
 * useLayoutEffect and let CSS transition handle the interpolation.
 */
export default function ViewModeSelector({ mode, onChange }: Props) {
  const btnRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const [indicator, setIndicator] = useState<{ x: number; w: number } | null>(null);
  // First measurement should snap to position (no animation on mount).
  // Subsequent mode changes animate. The flag flips after the first rAF
  // following initial measurement so the browser commits the non-animated
  // position before transitions turn on.
  const [animate, setAnimate] = useState(false);

  const activeIndex = Math.max(0, MODES.findIndex(m => m.value === mode));

  // Measure on mode change.
  useLayoutEffect(() => {
    const btn = btnRefs.current[activeIndex];
    if (!btn) return;
    setIndicator({ x: btn.offsetLeft, w: btn.offsetWidth });
  }, [activeIndex]);

  // Flip the animate flag after the first measurement + rAF so the initial
  // render paints without a transition, and subsequent updates animate.
  useEffect(() => {
    if (indicator && !animate) {
      const id = requestAnimationFrame(() => setAnimate(true));
      return () => cancelAnimationFrame(id);
    }
  }, [indicator, animate]);

  // Re-measure if any button's size changes (font loading, language swap,
  // container resize from orientation change). Keeps the pill glued to the
  // active button even when the layout shifts under it.
  useEffect(() => {
    const ro = new ResizeObserver(() => {
      const btn = btnRefs.current[activeIndex];
      if (!btn) return;
      setIndicator({ x: btn.offsetLeft, w: btn.offsetWidth });
    });
    btnRefs.current.forEach(b => { if (b) ro.observe(b); });
    return () => ro.disconnect();
  }, [activeIndex]);

  return (
    <div
      className="absolute top-3.5 left-1/2 -translate-x-1/2 z-10 flex p-1 rounded-full"
      role="radiogroup"
      aria-label="Modo de visualização"
      style={{
        background: 'var(--overlay-panel)',
        border: '0.5px solid var(--border)',
        boxShadow: '0 1px 2px rgba(0, 0, 0, 0.04), 0 4px 16px rgba(0, 0, 0, 0.06)',
      }}
    >
      {/* Sliding pill — behind the buttons. Positioned/sized by measuring
          the active button. Rendered only after the first measurement so
          it never appears at x=0 waiting for layout. */}
      {indicator && (
        <div
          aria-hidden="true"
          style={{
            position: 'absolute',
            top: 4,
            bottom: 4,
            left: indicator.x,
            width: indicator.w,
            background: 'var(--accent)',
            borderRadius: 9999,
            boxShadow: '0 1px 2px rgba(0, 0, 0, 0.10), 0 2px 8px rgba(0, 0, 0, 0.08)',
            transition: animate
              ? 'left 320ms cubic-bezier(0.32,0.72,0,1), width 320ms cubic-bezier(0.32,0.72,0,1)'
              : 'none',
            pointerEvents: 'none',
            zIndex: 0,
          }}
        />
      )}

      {MODES.map((m, i) => {
        const on = mode === m.value;
        return (
          <button
            key={m.value}
            ref={el => { btnRefs.current[i] = el; }}
            role="radio"
            aria-checked={on}
            onClick={() => onChange(m.value)}
            className="flex items-center gap-2 px-5 py-[7px] rounded-full text-[13px] font-medium
                       cursor-pointer border-0 outline-none bg-transparent
                       focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:ring-offset-0"
            style={{
              position: 'relative',
              zIndex: 1,
              color: on ? 'var(--on-accent)' : 'var(--text-muted)',
              transition: 'color 220ms cubic-bezier(0.32,0.72,0,1)',
            }}
            onMouseEnter={e => {
              if (!on) (e.currentTarget as HTMLButtonElement).style.color = 'var(--text-primary)';
            }}
            onMouseLeave={e => {
              if (!on) (e.currentTarget as HTMLButtonElement).style.color = 'var(--text-muted)';
            }}
          >
            {m.icon}
            {m.label}
          </button>
        );
      })}
    </div>
  );
}
