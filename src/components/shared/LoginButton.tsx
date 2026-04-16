import { useAuth } from './AuthProvider';

export default function LoginButton() {
  const { user, login, logout } = useAuth();

  const baseStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    height: 36,
    padding: '0 14px',
    borderRadius: 8,
    fontSize: 12,
    fontWeight: 500,
    letterSpacing: '0.01em',
    cursor: 'pointer',
    whiteSpace: 'nowrap',
    transition: 'all 0.2s',
    background: 'transparent',
    border: user ? '1px solid var(--accent)' : '1px solid var(--border)',
    color: user ? 'var(--accent)' : 'var(--text-muted)',
  };

  return (
    <button
      onClick={user ? logout : login}
      aria-label={user ? `Logado como ${user.name}. Clique para sair.` : 'Fazer login com Google (restrito a HYPR)'}
      style={baseStyle}
      onMouseEnter={e => {
        if (user) {
          e.currentTarget.style.background = 'var(--accent-muted)';
        } else {
          e.currentTarget.style.borderColor = 'var(--border-hover)';
          e.currentTarget.style.color = 'var(--text-secondary)';
          e.currentTarget.style.background = 'var(--hover-bg)';
        }
      }}
      onMouseLeave={e => {
        e.currentTarget.style.background = 'transparent';
        e.currentTarget.style.borderColor = user ? 'var(--accent)' : 'var(--border)';
        e.currentTarget.style.color = user ? 'var(--accent)' : 'var(--text-muted)';
      }}
    >
      {user ? (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
          <path d="M7 11V7a5 5 0 0 1 9.9-1" />
        </svg>
      ) : (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
          <path d="M7 11V7a5 5 0 0 1 10 0v4" />
        </svg>
      )}
      <span style={{ display: 'none' }} className="md:!inline">
        {user ? user.name.split(' ')[0] : 'HYPR'}
      </span>
    </button>
  );
}
