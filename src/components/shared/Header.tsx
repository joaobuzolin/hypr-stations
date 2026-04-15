import ThemeToggle from './ThemeToggle';

interface HeaderProps {
  currentPage?: string;
}

export default function Header({ currentPage }: HeaderProps) {
  return (
    <header className="flex items-center justify-between px-6 h-14 border-b
                        bg-[var(--bg-surface)] border-[var(--border)]
                        transition-colors duration-250 shrink-0 z-50 relative">
      {/* Logo */}
      <a href="/" className="flex items-center gap-3 no-underline">
        <div className="w-8 h-8 rounded-lg bg-[var(--accent)] flex items-center justify-center">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" className="text-[var(--on-accent)]">
            <path d="M4 6h4v12H4V6zm6 4h4v8h-4v-8zm6-2h4v10h-4V8z" fill="currentColor" />
          </svg>
        </div>
        <div className="flex items-baseline gap-1.5">
          <span className="font-heading text-sm font-bold tracking-wide text-[var(--text-primary)]">
            HYPR
          </span>
          <span className="font-heading text-sm font-semibold tracking-wide text-[var(--accent)]">
            Station
          </span>
        </div>
      </a>

      {/* Nav (desktop) */}
      <nav className="hidden md:flex items-center gap-1">
        {[
          { label: 'Hub', href: '/' },
          { label: 'Radio Map', href: '/radio' },
          { label: 'Cell Map', href: '/cell' },
        ].map((item) => {
          const isActive = currentPage === item.href ||
            (item.href !== '/' && currentPage?.startsWith(item.href));
          return (
            <a
              key={item.href}
              href={item.href}
              className={`px-3 py-1.5 rounded-md text-xs font-medium tracking-wide uppercase
                transition-colors duration-150 no-underline
                ${isActive
                  ? 'text-[var(--accent)] bg-[var(--accent-muted)]'
                  : 'text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-surface2)]'
                }`}
            >
              {item.label}
            </a>
          );
        })}
      </nav>

      {/* Actions */}
      <div className="flex items-center gap-2">
        <ThemeToggle />
      </div>
    </header>
  );
}
