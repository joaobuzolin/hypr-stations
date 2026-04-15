import type { MapStatus } from '../../lib/constants';

interface MapCardProps {
  name: string;
  subtitle: string;
  description: string;
  icon: string;
  href: string;
  status: MapStatus;
  stats: { stations: string; types: string; source: string };
}

const STATUS_LABELS: Record<MapStatus, string> = {
  'active': '',
  'coming-soon': 'Em breve',
  'planned': 'Planejado',
};

function MapIcon({ icon }: { icon: string }) {
  const cls = "w-8 h-8";
  switch (icon) {
    case 'radio':
      return (
        <svg className={cls} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M4.9 19.1C1 15.2 1 8.8 4.9 4.9" />
          <path d="M7.8 16.2c-2.3-2.3-2.3-6.1 0-8.4" />
          <circle cx="12" cy="12" r="2" />
          <path d="M16.2 7.8c2.3 2.3 2.3 6.1 0 8.4" />
          <path d="M19.1 4.9C23 8.8 23 15.1 19.1 19" />
        </svg>
      );
    case 'signal':
      return (
        <svg className={cls} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M2 20h.01" /><path d="M7 20v-4" /><path d="M12 20v-8" />
          <path d="M17 20V8" /><path d="M22 4v16" />
        </svg>
      );
    case 'tv':
      return (
        <svg className={cls} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <rect x="2" y="7" width="20" height="15" rx="2" ry="2" />
          <polyline points="17 2 12 7 7 2" />
        </svg>
      );
    default:
      return null;
  }
}

export default function MapCard({ name, subtitle, description, icon, href, status, stats }: MapCardProps) {
  const isActive = status === 'active';

  const content = (
    <div className={`group relative flex flex-col h-full p-6 rounded-2xl border
                     transition-all duration-300
                     ${isActive
                       ? 'border-[var(--border)] bg-[var(--bg-surface)] hover:border-[var(--accent)] hover:shadow-[var(--shadow-card-hover)] cursor-pointer'
                       : 'border-[var(--border)] bg-[var(--bg-surface)] opacity-50 cursor-default'
                     }`}>

      {/* Status badge */}
      {!isActive && (
        <span className="absolute top-4 right-4 text-[10px] font-semibold uppercase tracking-wider
                         px-2.5 py-1 rounded-full
                         bg-[var(--accent-muted)] text-[var(--accent)]">
          {STATUS_LABELS[status]}
        </span>
      )}

      {/* Icon */}
      <div className={`w-14 h-14 rounded-xl flex items-center justify-center mb-5
                       transition-colors duration-300
                       ${isActive
                         ? 'bg-[var(--accent-muted)] text-[var(--accent)] group-hover:bg-[var(--accent)] group-hover:text-[var(--on-accent)]'
                         : 'bg-[var(--bg-surface2)] text-[var(--text-muted)]'
                       }`}>
        <MapIcon icon={icon} />
      </div>

      {/* Title */}
      <h3 className="font-heading text-lg font-bold text-[var(--text-primary)] mb-1">
        {name}
      </h3>
      <p className="text-xs font-medium uppercase tracking-wider text-[var(--text-muted)] mb-3">
        {subtitle}
      </p>

      {/* Description */}
      <p className="text-sm text-[var(--text-secondary)] leading-relaxed mb-5 flex-1">
        {description}
      </p>

      {/* Stats */}
      <div className="flex gap-4 pt-4 border-t border-[var(--border)]">
        {Object.entries(stats).map(([key, val]) => (
          <div key={key} className="flex flex-col">
            <span className={`text-sm font-bold ${isActive ? 'text-[var(--accent)]' : 'text-[var(--text-muted)]'}`}>
              {val}
            </span>
            <span className="text-[10px] uppercase tracking-wider text-[var(--text-muted)]">
              {key === 'stations' ? 'Estações' : key === 'types' ? 'Tipos' : 'Fonte'}
            </span>
          </div>
        ))}
      </div>

      {/* Arrow indicator */}
      {isActive && (
        <div className="absolute bottom-6 right-6 w-8 h-8 rounded-full
                        flex items-center justify-center
                        bg-[var(--bg-surface2)] text-[var(--text-muted)]
                        group-hover:bg-[var(--accent)] group-hover:text-[var(--on-accent)]
                        transition-all duration-300 group-hover:translate-x-0.5">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <line x1="5" y1="12" x2="19" y2="12" /><polyline points="12 5 19 12 12 19" />
          </svg>
        </div>
      )}
    </div>
  );

  if (isActive) {
    return <a href={href} className="no-underline block">{content}</a>;
  }
  return content;
}
