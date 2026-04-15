import type { MapStatus } from '../../lib/constants';

interface MapCardProps {
  name: string;
  subtitle: string;
  description: string;
  icon: string;
  href: string;
  status: MapStatus;
}

const STATUS_LABELS: Record<MapStatus, string> = {
  'active': '',
  'coming-soon': 'Em breve',
  'planned': 'Planejado',
};

function MapIcon({ icon }: { icon: string }) {
  const props = { className: "w-6 h-6", viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.5, strokeLinecap: "round" as const, strokeLinejoin: "round" as const, 'aria-hidden': true as const };
  switch (icon) {
    case 'radio':
      return (<svg {...props}><path d="M4.9 19.1C1 15.2 1 8.8 4.9 4.9" /><path d="M7.8 16.2c-2.3-2.3-2.3-6.1 0-8.4" /><circle cx="12" cy="12" r="2" /><path d="M16.2 7.8c2.3 2.3 2.3 6.1 0 8.4" /><path d="M19.1 4.9C23 8.8 23 15.1 19.1 19" /></svg>);
    case 'signal':
      return (<svg {...props}><path d="M2 20h.01" /><path d="M7 20v-4" /><path d="M12 20v-8" /><path d="M17 20V8" /><path d="M22 4v16" /></svg>);
    case 'tv':
      return (<svg {...props}><rect x="2" y="7" width="20" height="15" rx="2" ry="2" /><polyline points="17 2 12 7 7 2" /></svg>);
    default:
      return null;
  }
}

export default function MapCard({ name, subtitle, description, icon, href, status }: MapCardProps) {
  const isActive = status === 'active';

  const content = (
    <div className={`group flex flex-col items-center text-center h-full
                     px-8 py-10 rounded-xl border transition-all duration-300
                     ${isActive
                       ? 'border-[var(--border)] bg-[var(--bg-surface)] hover:border-[var(--accent)] hover:shadow-[var(--shadow-card-hover)] cursor-pointer'
                       : 'border-[var(--border)] bg-[var(--bg-surface)] opacity-40 cursor-default'
                     }`}>

      {/* Icon */}
      <div className={`w-11 h-11 rounded-xl flex items-center justify-center mb-5
                       transition-colors duration-300
                       ${isActive
                         ? 'bg-[var(--accent-muted)] text-[var(--accent)] group-hover:bg-[var(--accent)] group-hover:text-[var(--on-accent)]'
                         : 'bg-[var(--bg-surface2)] text-[var(--text-muted)]'
                       }`}>
        <MapIcon icon={icon} />
      </div>

      {/* Title */}
      <h2 className="font-heading text-base font-bold text-[var(--text-primary)] mb-2">
        {name}
      </h2>

      {/* Description */}
      <p className="text-xs text-[var(--text-muted)] leading-relaxed max-w-[200px]">
        {subtitle}
      </p>

      {/* Status badge for inactive */}
      {!isActive && (
        <span className="mt-5 text-micro font-semibold uppercase tracking-wider
                         px-3 py-1 rounded-lg
                         bg-[var(--accent-muted)] text-[var(--accent)]">
          {STATUS_LABELS[status]}
        </span>
      )}

      {/* Arrow for active */}
      {isActive && (
        <div className="mt-5 w-7 h-7 rounded-lg flex items-center justify-center
                        bg-[var(--bg-surface2)] text-[var(--text-muted)]
                        group-hover:bg-[var(--accent)] group-hover:text-[var(--on-accent)]
                        transition-all duration-300"
             aria-hidden="true">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
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
