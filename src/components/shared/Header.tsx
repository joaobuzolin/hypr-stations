import ThemeToggle from './ThemeToggle';
import LoginButton from './LoginButton';

interface HeaderProps {
  currentPage?: string;
  showAuth?: boolean;
}

const NAV_ITEMS = [
  { label: 'Hub', href: '/' },
  { label: 'Radio map', href: '/radio' },
  { label: 'Cell map', href: '/cell' },
];

function HeaderInner({ currentPage, showAuth = false }: HeaderProps) {
  return (
    <header
      className="flex items-center h-14 px-7 border-b shrink-0 z-50 relative
                 bg-[var(--bg-surface)] border-[var(--border)]
                 transition-colors duration-300"
    >
      {/* Logo */}
      <a href="/" className="flex items-center gap-[11px] no-underline shrink-0">
        <div className="w-8 h-8 rounded-[9px] bg-[var(--accent)] flex items-center justify-center">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" className="text-[var(--on-accent)]">
            <path d="M4 6h4v12H4V6zm6 4h4v8h-4v-8zm6-2h4v10h-4V8z" fill="currentColor" />
          </svg>
        </div>
        <div className="flex items-baseline gap-0.5">
          <span className="font-heading text-[14px] font-bold tracking-[0.01em] text-[var(--text-primary)]">
            HYPR
          </span>
          <span className="font-heading text-[14px] font-bold tracking-[0.01em] text-[var(--accent)]">
            Station
          </span>
        </div>
      </a>

      {/* Nav (desktop) */}
      <nav className="hidden md:flex items-center gap-1 ml-10">
        {NAV_ITEMS.map((item) => {
          const isActive =
            currentPage === item.href ||
            (item.href !== '/' && currentPage?.startsWith(item.href));
          return (
            <a
              key={item.href}
              href={item.href}
              className={`px-[18px] py-2 rounded-lg text-[12px] font-medium tracking-[0.01em]
                transition-all duration-200 no-underline
                ${isActive
                  ? 'text-[var(--accent)] bg-[var(--accent-muted)]'
                  : 'text-[var(--text-muted)] hover:text-[var(--text-secondary)] hover:bg-[var(--bg-surface2)]'
                }`}
            >
              {item.label}
            </a>
          );
        })}
      </nav>

      {/* Actions */}
      <div className="flex items-center gap-3 ml-auto">
        {showAuth && <LoginButton />}
        <ThemeToggle />
      </div>
    </header>
  );
}

export default function Header(props: HeaderProps) {
  return <HeaderInner {...props} />;
}
