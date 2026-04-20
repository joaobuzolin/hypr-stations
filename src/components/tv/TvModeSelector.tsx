import { useEffect, useLayoutEffect, useRef, useState } from 'react';

export type TvMode = 'cobertura' | 'audiencia';

interface Props {
  mode: TvMode;
  onChange: (mode: TvMode) => void;
}

const MODES: Array<{ value: TvMode; label: string; icon: JSX.Element }> = [
  { value: 'cobertura', label: 'Cobertura', icon: (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M5 12.55a11 11 0 0 1 14 0"/><path d="M8.5 16.43a6 6 0 0 1 7 0"/><circle cx="12" cy="20" r="1" fill="currentColor"/>
    </svg>
  )},
  { value: 'audiencia', label: 'Audiência', icon: (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M3 3v18h18"/><path d="M7 14l4-4 4 3 5-7"/>
    </svg>
  )},
];

export default function TvModeSelector({ mode, onChange }: Props) {
  const btnRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const [indicator, setIndicator] = useState<{ x: number; w: number } | null>(null);
  const [animate, setAnimate] = useState(false);

  const activeIndex = Math.max(0, MODES.findIndex(m => m.value === mode));

  useLayoutEffect(() => {
    const btn = btnRefs.current[activeIndex];
    if (!btn) return;
    setIndicator({ x: btn.offsetLeft, w: btn.offsetWidth });
  }, [activeIndex]);

  useEffect(() => {
    if (indicator && !animate) {
      const id = requestAnimationFrame(() => setAnimate(true));
      return () => cancelAnimationFrame(id);
    }
  }, [indicator, animate]);

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
