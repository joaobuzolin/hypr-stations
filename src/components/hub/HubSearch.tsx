import { useEffect, useRef } from 'react';

export default function HubSearch() {
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        inputRef.current?.focus();
      }
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const q = inputRef.current?.value.trim();
    if (q) window.location.href = `/cell?q=${encodeURIComponent(q)}`;
  };

  return (
    <form onSubmit={handleSubmit} className="relative max-w-[480px] mx-auto">
      <svg
        className="absolute left-4 top-1/2 -translate-y-1/2 text-[var(--text-faint)] transition-colors duration-200
                   peer-focus:text-[var(--accent)]"
        width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
        strokeLinecap="round" strokeLinejoin="round"
      >
        <circle cx="11" cy="11" r="8" />
        <line x1="21" y1="21" x2="16.65" y2="16.65" />
      </svg>
      <input
        ref={inputRef}
        type="text"
        placeholder="Buscar município, estado ou estação..."
        className="peer w-full h-12 pl-11 pr-16 rounded-[24px] text-[13px] tracking-[0.01em]
                   bg-[var(--bg-surface)] border border-[var(--border)]
                   text-[var(--text-primary)] placeholder:text-[var(--text-faint)]
                   outline-none transition-all duration-300
                   focus:border-[var(--accent)] focus:bg-[var(--bg-surface2)]"
      />
      <kbd className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none
                      text-[11px] text-[var(--text-faint)] bg-[var(--bg-surface2)]
                      border border-[var(--border)] px-2 py-0.5 rounded-md font-body">
        ⌘K
      </kbd>
    </form>
  );
}
