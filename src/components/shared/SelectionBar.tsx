import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { usePresence } from './hooks/usePresence';
import { useIsDesktop } from './hooks/useMediaQuery';

interface SelectionBarProps {
  count: number;
  summary: ReactNode;
  onCheckout: () => void;
  onDownload?: () => void;
  canDownload?: boolean;
  /** Fires whenever the rendered height changes (including mount/unmount
   *  where it fires with 0). Consumers use this to reserve bottom space
   *  for overlapping overlays like DominancePanel, CellLegend, raios toggle.
   *  On mobile the compact pill reports its own smaller footprint. */
  onHeightChange?: (height: number) => void;
}

const ANIM_MS = 260;

/**
 * Two faces, one component:
 *   - Desktop (≥768px): horizontal bar pinned to the bottom of the viewport
 *     with count + summary + optional export + primary CTA.
 *   - Mobile: compact floating pill centered above the bottom tab bar.
 *     Tap expands into a dropup panel with summary + actions. Keeps the
 *     tab bar visible so the user can still navigate while building a plan.
 *
 * The mobile pill is inspired by Shopee/iFood-style cart pills — minimum
 * viewport cost, maximum discoverability via the count badge.
 */
export default function SelectionBar({
  count,
  summary,
  onCheckout,
  onDownload,
  canDownload,
  onHeightChange,
}: SelectionBarProps) {
  const isDesktop = useIsDesktop();
  const hasItems = count > 0;
  const { mounted, visible } = usePresence(hasItems, ANIM_MS);

  const rootRef = useRef<HTMLDivElement>(null);
  const lastReported = useRef<number>(0);

  // Count bump animation — re-triggers whenever `count` changes by having a
  // key that flips with each mutation.
  const [bumpKey, setBumpKey] = useState(0);
  const prevCount = useRef(count);
  useEffect(() => {
    if (count !== prevCount.current && count > 0) {
      setBumpKey(k => k + 1);
    }
    prevCount.current = count;
  }, [count]);

  // Report height to parent via ResizeObserver — covers px-5 vs md:px-7,
  // desktop-vs-mobile swap, orientation change, safe-area, etc.
  useLayoutEffect(() => {
    if (!onHeightChange) return;
    if (!mounted) {
      if (lastReported.current !== 0) {
        lastReported.current = 0;
        onHeightChange(0);
      }
      return;
    }
    const el = rootRef.current;
    if (!el) return;
    const report = () => {
      const h = el.offsetHeight;
      if (h !== lastReported.current) {
        lastReported.current = h;
        onHeightChange(h);
      }
    };
    report();
    const ro = new ResizeObserver(report);
    ro.observe(el);
    return () => ro.disconnect();
  }, [mounted, isDesktop, onHeightChange]);

  // Emit 0 on unmount to clear any reserved space on consumers.
  useEffect(
    () => () => {
      if (onHeightChange && lastReported.current !== 0) onHeightChange(0);
    },
    [onHeightChange]
  );

  // Mobile expand/collapse state — only relevant when !isDesktop.
  const [mobileExpanded, setMobileExpanded] = useState(false);
  useEffect(() => {
    if (!hasItems) setMobileExpanded(false);
  }, [hasItems]);

  if (!mounted) return null;

  if (isDesktop) {
    return (
      <div
        ref={rootRef}
        role="status"
        aria-live="polite"
        data-visible={visible}
        style={{ transition: `transform ${ANIM_MS}ms cubic-bezier(0.32,0.72,0,1), opacity 180ms ease` }}
        className="fixed bottom-0 left-0 right-0 z-[1400] border-t px-5 md:px-7 py-3.5
                   pb-[calc(0.875rem+env(safe-area-inset-bottom))] md:pb-3.5
                   flex items-center gap-4
                   bg-[var(--bg-surface)] border-[var(--border)]
                   data-[visible=false]:translate-y-full data-[visible=false]:opacity-0
                   translate-y-0 opacity-100"
      >
        <span
          key={bumpKey}
          className="font-heading text-[22px] font-bold text-[var(--accent)] tracking-[-0.01em]"
          style={{ animation: 'countBump 0.32s cubic-bezier(0.16,1,0.3,1)' }}
        >
          {count}
        </span>

        <div className="text-[12px] text-[var(--text-secondary)] leading-snug">{summary}</div>

        <div className="ml-auto flex items-center gap-2">
          {canDownload && onDownload && (
            <button
              onClick={onDownload}
              aria-label="Exportar base de endereços selecionados"
              className="flex items-center gap-1.5 px-5 py-2.5 rounded-[10px]
                         text-[12px] font-semibold transition-all duration-200 cursor-pointer
                         bg-transparent text-[var(--accent)] outline-none
                         hover:bg-[var(--accent-muted)] active:scale-[0.98]"
              style={{ border: '0.5px solid var(--accent)' }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                <polyline points="7 10 12 15 17 10" />
                <line x1="12" y1="15" x2="12" y2="3" />
              </svg>
              Exportar base
            </button>
          )}
          <button
            onClick={onCheckout}
            className="flex items-center gap-1.5 px-6 py-2.5 rounded-[10px]
                       text-[12px] font-semibold transition-all duration-200 cursor-pointer
                       bg-[var(--accent)] text-[var(--on-accent)] border-0 outline-none
                       hover:opacity-90 active:scale-[0.98]"
          >
            Montar plano
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <line x1="5" y1="12" x2="19" y2="12" />
              <polyline points="12 5 19 12 12 19" />
            </svg>
          </button>
        </div>
      </div>
    );
  }

  // Mobile pill — sits above the bottom tab bar (~55px). Safe area is
  // applied via env() so it lifts on devices with home indicators.
  return (
    <div
      ref={rootRef}
      role="status"
      aria-live="polite"
      data-visible={visible}
      style={{
        bottom: 'calc(55px + env(safe-area-inset-bottom) + 10px)',
        transition: `transform ${ANIM_MS}ms cubic-bezier(0.32,0.72,0,1), opacity 180ms ease`,
      }}
      className="fixed left-0 right-0 z-[1400] flex flex-col items-stretch px-3
                 data-[visible=false]:translate-y-[calc(100%+80px)] data-[visible=false]:opacity-0
                 translate-y-0 opacity-100"
    >
      {/* Expanded panel (dropup) */}
      {mobileExpanded && (
        <div
          className="mb-2 rounded-[14px] border-[0.5px] border-[var(--border)]
                     bg-[var(--bg-surface)] shadow-[0_12px_32px_rgba(0,0,0,0.25)]
                     overflow-hidden"
          style={{ animation: 'fadeUp 0.2s cubic-bezier(0.16,1,0.3,1) both' }}
        >
          <div className="px-4 py-3 border-b border-[var(--border)] flex items-center gap-3">
            <span className="font-heading text-[20px] font-bold text-[var(--accent)] tracking-[-0.01em]">
              {count}
            </span>
            <div className="text-[11px] text-[var(--text-secondary)] leading-snug flex-1 min-w-0">
              {summary}
            </div>
            <button
              onClick={() => setMobileExpanded(false)}
              aria-label="Fechar"
              className="w-7 h-7 rounded-lg bg-[var(--bg-surface2)] text-[var(--text-muted)]
                         hover:text-[var(--text-primary)] active:scale-[0.92]
                         flex items-center justify-center text-[14px] border-0 outline-none
                         transition-all duration-150 cursor-pointer"
            >
              ×
            </button>
          </div>
          {canDownload && onDownload && (
            <button
              onClick={() => {
                onDownload();
                setMobileExpanded(false);
              }}
              className="w-full flex items-center justify-center gap-1.5 px-4 py-3
                         text-[12px] font-semibold cursor-pointer border-0 outline-none
                         bg-transparent text-[var(--accent)] active:bg-[var(--accent-muted)]
                         border-b border-[var(--border)] transition-colors duration-150"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                <polyline points="7 10 12 15 17 10" />
                <line x1="12" y1="15" x2="12" y2="3" />
              </svg>
              Exportar base
            </button>
          )}
        </div>
      )}

      {/* Compact pill — always rendered; click cycles expand/collapse, or
          jumps straight to checkout if already expanded. */}
      <button
        onClick={() => {
          if (mobileExpanded) onCheckout();
          else setMobileExpanded(true);
        }}
        aria-label={mobileExpanded ? 'Montar plano' : `Ver ${count} seleções`}
        aria-expanded={mobileExpanded}
        className="w-full h-12 rounded-full flex items-center justify-between px-5
                   bg-[var(--accent)] text-[var(--on-accent)] font-semibold text-[13px]
                   border-0 outline-none cursor-pointer shadow-[0_8px_24px_rgba(0,0,0,0.25)]
                   active:scale-[0.98] transition-transform duration-150"
      >
        <span className="flex items-center gap-2.5">
          <span
            key={bumpKey}
            className="inline-flex items-center justify-center min-w-[22px] h-[22px] px-1.5
                       rounded-full bg-black/20 text-[11px] font-bold tabular-nums"
            style={{ animation: 'countBump 0.32s cubic-bezier(0.16,1,0.3,1)' }}
          >
            {count}
          </span>
          <span>{mobileExpanded ? 'Montar plano' : 'No plano'}</span>
        </span>
        <svg
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
          style={{
            transition: 'transform 0.2s ease',
            transform: mobileExpanded ? 'rotate(-90deg)' : 'rotate(0deg)',
          }}
        >
          <line x1="5" y1="12" x2="19" y2="12" />
          <polyline points="12 5 19 12 12 19" />
        </svg>
      </button>
    </div>
  );
}
