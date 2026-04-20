import ThemeToggle from './ThemeToggle';
import LoginButton from './LoginButton';

interface HeaderProps {
  currentPage?: string;
  showAuth?: boolean;
}

const NAV_ITEMS = [
  { label: 'Hub', href: '/', icon: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="7" height="7" rx="1" /><rect x="14" y="3" width="7" height="7" rx="1" /><rect x="3" y="14" width="7" height="7" rx="1" /><rect x="14" y="14" width="7" height="7" rx="1" />
    </svg>
  )},
  { label: 'Radio', href: '/radio', icon: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4.9 19.1C1 15.2 1 8.8 4.9 4.9" /><path d="M7.8 16.2c-2.3-2.3-2.3-6.1 0-8.4" />
      <circle cx="12" cy="12" r="2" /><path d="M16.2 7.8c2.3 2.3 2.3 6.1 0 8.4" /><path d="M19.1 4.9C23 8.8 23 15.1 19.1 19" />
    </svg>
  )},
  { label: 'Cell', href: '/cell', icon: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M2 20h.01" /><path d="M7 20v-4" /><path d="M12 20v-8" /><path d="M17 20V8" /><path d="M22 4v16" />
    </svg>
  )},
  { label: 'TV', href: '/tv', icon: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="7" width="20" height="13" rx="2" ry="2" /><polyline points="17 2 12 7 7 2" />
    </svg>
  )},
];

function HeaderInner({ currentPage, showAuth = false }: HeaderProps) {
  return (
    <header
      className="flex items-center h-14 px-5 md:px-7 border-b shrink-0 z-50 relative
                 bg-[var(--bg-surface)] border-[var(--border)]
                 transition-colors duration-300"
    >
      {/* Logo */}
      <a href="/" className="flex items-center gap-[11px] no-underline shrink-0">
        <div className="w-10 h-10 rounded-[10px] bg-[var(--accent)] flex items-center justify-center">
          <svg
            width="22"
            height="22"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="text-[var(--on-accent)]"
            aria-hidden="true"
          >
            <line x1="12" y1="4" x2="12" y2="21" />
            <path d="M8 8 Q 6 11 8 14" />
            <path d="M16 8 Q 18 11 16 14" />
            <path d="M5 6 Q 1.5 11 5 16" />
            <path d="M19 6 Q 22.5 11 19 16" />
            <circle cx="12" cy="3.5" r="1.3" fill="currentColor" stroke="none" />
          </svg>
        </div>
        <div className="hidden sm:flex items-baseline gap-1">
          <span className="font-heading text-[24px] font-semibold tracking-[0.01em] text-[var(--text-primary)]">HYPR</span>
          <span className="font-heading text-[24px] font-semibold tracking-[0.01em] text-[var(--accent)]">Station</span>
        </div>
      </a>

      {/* Nav (desktop) */}
      <nav className="hidden md:flex items-center gap-1 ml-10">
        {NAV_ITEMS.map((item) => {
          const isActive = currentPage === item.href || (item.href !== '/' && currentPage?.startsWith(item.href));
          return (
            <a key={item.href} href={item.href}
              className={`px-[18px] py-2 rounded-lg text-[12px] font-medium tracking-[0.01em]
                transition-all duration-200 no-underline active:scale-[0.96]
                ${isActive
                  ? 'text-[var(--accent)] bg-[var(--accent-muted)]'
                  : 'text-[var(--text-muted)] hover:text-[var(--text-secondary)] hover:bg-[var(--bg-surface2)]'
                }`}>
              {item.label}
            </a>
          );
        })}
      </nav>

      {/* Actions */}
      <div className="flex items-center gap-2 md:gap-3 ml-auto">
        {showAuth && <LoginButton />}
        <ThemeToggle />
      </div>

      {/* Mobile bottom tab bar */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-[1300] flex
                      bg-[var(--bg-surface)] border-t border-[var(--border)]
                      pb-[env(safe-area-inset-bottom)]"
           aria-label="Navegação principal">
        {NAV_ITEMS.map((item) => {
          const isActive = currentPage === item.href || (item.href !== '/' && currentPage?.startsWith(item.href));
          return (
            <a key={item.href} href={item.href}
              className={`flex-1 flex flex-col items-center gap-1 py-2.5 no-underline
                transition-colors duration-200 active:scale-[0.96] transition-transform
                ${isActive
                  ? 'text-[var(--accent)]'
                  : 'text-[var(--text-muted)]'
                }`}>
              <span className={`relative flex items-center justify-center transition-transform duration-200 ${isActive ? 'scale-[1.08]' : 'scale-100'}`}>
                {item.icon}
                {isActive && (
                  <span
                    aria-hidden="true"
                    className="absolute -top-2 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-[var(--accent)]"
                    style={{ animation: 'popIn 0.3s cubic-bezier(0.16,1,0.3,1) both' }}
                  />
                )}
              </span>
              <span className="text-[10px] font-medium">{item.label}</span>
            </a>
          );
        })}
      </nav>
    </header>
  );
}

export default function Header(props: HeaderProps) {
  return <HeaderInner {...props} />;
}
