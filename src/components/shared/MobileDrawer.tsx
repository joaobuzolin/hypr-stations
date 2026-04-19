import { useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { usePresence } from './hooks/usePresence';

interface MobileDrawerProps {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
}

const ANIM_MS = 280;
const CLOSE_DISTANCE_THRESHOLD = 0.35; // 35% of drawer height
const CLOSE_VELOCITY_THRESHOLD = 0.6; // px/ms — quick flick

export default function MobileDrawer({ open, onClose, title, children }: MobileDrawerProps) {
  const titleId = useId();
  const { mounted, visible } = usePresence(open, ANIM_MS);

  const sheetRef = useRef<HTMLDivElement>(null);
  const [dragY, setDragY] = useState(0); // current drag offset from resting position
  const dragState = useRef({
    startY: 0,
    startTime: 0,
    active: false,
    sheetHeight: 0,
    lastY: 0,
    lastTime: 0,
    velocity: 0,
  });

  // Lock body scroll while drawer is mounted. Prevents scroll-chaining
  // under the backdrop on iOS/Android.
  useEffect(() => {
    if (!mounted) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prev; };
  }, [mounted]);

  // Reset drag when drawer opens.
  useEffect(() => {
    if (open) setDragY(0);
  }, [open]);

  const onTouchStart = (e: React.TouchEvent) => {
    if (!sheetRef.current) return;
    const t = e.touches[0];
    dragState.current.startY = t.clientY;
    dragState.current.startTime = performance.now();
    dragState.current.lastY = t.clientY;
    dragState.current.lastTime = dragState.current.startTime;
    dragState.current.velocity = 0;
    dragState.current.active = true;
    dragState.current.sheetHeight = sheetRef.current.offsetHeight;
  };

  const onTouchMove = (e: React.TouchEvent) => {
    if (!dragState.current.active) return;
    const t = e.touches[0];
    const dy = t.clientY - dragState.current.startY;
    // Only drag downward; resist upward pulls past resting (rubber band a
    // bit, but clamp hard at -12px to feel solid).
    const next = dy < 0 ? Math.max(dy * 0.3, -12) : dy;
    setDragY(next);

    // Rolling velocity estimate — smoother than two-sample finite diff
    // because the last value is always the most recent touch.
    const now = performance.now();
    const elapsed = now - dragState.current.lastTime;
    if (elapsed > 0) {
      dragState.current.velocity = (t.clientY - dragState.current.lastY) / elapsed;
    }
    dragState.current.lastY = t.clientY;
    dragState.current.lastTime = now;
  };

  const onTouchEnd = () => {
    if (!dragState.current.active) return;
    dragState.current.active = false;

    const distance = dragY;
    const height = dragState.current.sheetHeight || 1;
    const velocity = dragState.current.velocity; // positive = moving down
    const shouldClose =
      distance / height > CLOSE_DISTANCE_THRESHOLD ||
      velocity > CLOSE_VELOCITY_THRESHOLD;

    if (shouldClose) {
      onClose();
    } else {
      // Snap back to resting with animation.
      setDragY(0);
    }
  };

  if (!mounted) return null;

  // Compute transform: while visible and at rest, identity. While dragging,
  // follow finger. While entering/exiting (visible toggling), let CSS
  // transition handle the slide-up/slide-down.
  const translate =
    dragY !== 0
      ? `translateY(${dragY}px)`
      : visible
        ? 'translateY(0)'
        : 'translateY(100%)';

  return (
    <>
      <div
        aria-hidden="true"
        onClick={onClose}
        style={{
          position: 'fixed', inset: 0, zIndex: 1500,
          background: 'var(--overlay)',
          backdropFilter: 'blur(2px)',
          WebkitBackdropFilter: 'blur(2px)',
          opacity: visible ? 1 : 0,
          transition: `opacity ${ANIM_MS}ms ease`,
        }}
      />
      <div
        ref={sheetRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        style={{
          position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 1600,
          maxHeight: '85vh',
          background: 'var(--bg-surface)',
          borderTop: '1px solid var(--border)',
          borderTopLeftRadius: 16, borderTopRightRadius: 16,
          display: 'flex', flexDirection: 'column',
          transform: translate,
          transition:
            dragState.current.active
              ? 'none'
              : `transform ${ANIM_MS}ms cubic-bezier(0.32,0.72,0,1)`,
          touchAction: 'pan-y',
          paddingBottom: 'env(safe-area-inset-bottom)',
        }}
      >
        {/* Grab handle — also the primary swipe surface */}
        <div
          onTouchStart={onTouchStart}
          onTouchMove={onTouchMove}
          onTouchEnd={onTouchEnd}
          style={{ padding: '10px 0 4px', touchAction: 'none', cursor: 'grab' }}
        >
          <div
            className="w-9 h-1 rounded-full mx-auto"
            style={{ background: 'var(--border-hover)' }}
          />
        </div>

        <div className="flex items-center justify-between px-5 py-3 border-b border-[var(--border)]">
          <span id={titleId} className="text-[13px] font-semibold text-[var(--text-primary)]">{title}</span>
          <button
            onClick={onClose}
            aria-label="Fechar"
            className="w-7 h-7 rounded-lg bg-[var(--bg-surface2)] text-[var(--text-muted)]
                       hover:bg-[var(--bg-surface3)] active:scale-[0.92]
                       flex items-center justify-center cursor-pointer text-[13px] transition-all duration-150
                       border-0 outline-none"
          >×</button>
        </div>
        <div className="overflow-y-auto flex-1 overscroll-contain">
          {children}
          <div className="p-5">
            <button
              onClick={onClose}
              className="w-full py-3 rounded-[10px] bg-[var(--accent)] text-[var(--on-accent)]
                         font-heading font-semibold text-[13px] cursor-pointer hover:opacity-90
                         active:scale-[0.98] transition-all duration-200 border-0 outline-none"
            >
              Aplicar
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
