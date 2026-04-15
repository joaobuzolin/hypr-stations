import type { ReactNode } from 'react';

interface SelectionBarProps {
  count: number;
  summary: ReactNode;
  onCheckout: () => void;
  onDownload?: () => void;
  canDownload?: boolean;
}

export default function SelectionBar({ count, summary, onCheckout, onDownload, canDownload }: SelectionBarProps) {
  if (count === 0) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed bottom-0 left-0 right-0 z-[1400] border-t px-5 py-3
                 flex items-center gap-3
                 bg-[var(--bg-surface)] border-[var(--border)]
                 animate-[slideUp_0.3s_cubic-bezier(0.32,0.72,0,1)]"
    >
      <span className="font-heading text-xl font-extrabold text-[var(--accent)]">
        {count}
      </span>

      <div className="text-xs text-[var(--text-muted)] leading-snug">
        {summary}
      </div>

      <div className="ml-auto flex items-center gap-2">
        {canDownload && onDownload && (
          <button
            onClick={onDownload}
            aria-label="Exportar seleção como CSV"
            className="flex items-center gap-1 px-4 py-2 rounded-lg border
                       text-xs font-bold tracking-wide transition-all cursor-pointer
                       bg-transparent border-[var(--accent)] text-[var(--accent)]
                       hover:bg-[var(--accent-muted)]"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="7 10 12 15 17 10" />
              <line x1="12" y1="15" x2="12" y2="3" />
            </svg>
            CSV
          </button>
        )}
        <button
          onClick={onCheckout}
          className="flex items-center gap-1 px-5 py-2 rounded-lg
                     text-xs font-bold tracking-wide transition-all cursor-pointer
                     bg-[var(--accent)] text-[var(--on-accent)]
                     hover:opacity-90"
        >
          Montar plano
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <line x1="5" y1="12" x2="19" y2="12" /><polyline points="12 5 19 12 12 19" />
          </svg>
        </button>
      </div>
    </div>
  );
}
