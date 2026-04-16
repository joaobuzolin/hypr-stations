import type { MapStatus } from '../../lib/constants';

interface MapCardProps {
  name: string;
  subtitle: string;
  description: string;
  icon: string;
  href: string;
  status: MapStatus;
  stats: { stations: string; types: string; source: string };
  accentColor?: string;
}

const STATUS_LABELS: Record<MapStatus, string> = {
  'active': '',
  'coming-soon': 'Em breve',
  'planned': 'Planejado',
};

const ACCENT_MAP: Record<string, string> = {
  radio: 'var(--accent)',
  cell: '#5ba3e6',
  tv: '#d4c74a',
};

function MapIcon({ icon }: { icon: string }) {
  const props = {
    className: 'w-5 h-5',
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 1.5,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    'aria-hidden': true as const,
  };
  switch (icon) {
    case 'radio':
      return (
        <svg {...props}>
          <path d="M4.9 19.1C1 15.2 1 8.8 4.9 4.9" />
          <path d="M7.8 16.2c-2.3-2.3-2.3-6.1 0-8.4" />
          <circle cx="12" cy="12" r="2" />
          <path d="M16.2 7.8c2.3 2.3 2.3 6.1 0 8.4" />
          <path d="M19.1 4.9C23 8.8 23 15.1 19.1 19" />
        </svg>
      );
    case 'signal':
      return (
        <svg {...props}>
          <path d="M2 20h.01" /><path d="M7 20v-4" /><path d="M12 20v-8" />
          <path d="M17 20V8" /><path d="M22 4v16" />
        </svg>
      );
    case 'tv':
      return (
        <svg {...props}>
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
  const accent = ACCENT_MAP[icon] || 'var(--accent)';

  const content = (
    <div
      className={`group relative flex flex-col h-full rounded-[14px] border-[0.5px] overflow-hidden
                  transition-all duration-300
                  ${isActive
                    ? 'border-[var(--border)] bg-[var(--bg-surface)] hover:border-[var(--input-border)] hover:translate-y-[-2px] cursor-pointer'
                    : 'border-[var(--border)] bg-[var(--bg-surface)] opacity-25 cursor-default'
                  }`}
    >
      {/* Accent line (visible on hover) */}
      <div
        className="absolute top-0 left-0 right-0 h-[2px] opacity-0 group-hover:opacity-100 transition-opacity duration-300"
        style={{ background: accent }}
      />

      {/* Body */}
      <div className="flex flex-col flex-1 px-[26px] pt-7 pb-[22px]">
        {/* Icon + badge */}
        <div className="flex items-start justify-between mb-5">
          <div
            className="w-10 h-10 rounded-[11px] flex items-center justify-center
                       transition-transform duration-300 group-hover:scale-[1.06]"
            style={{
              background: accent + '14',
              color: accent,
            }}
          >
            <MapIcon icon={icon} />
          </div>
          {!isActive && (
            <span className="text-[11px] font-medium px-[11px] py-1 rounded-lg bg-[var(--accent-muted)] text-[var(--accent)]">
              {STATUS_LABELS[status]}
            </span>
          )}
        </div>

        {/* Title */}
        <h2 className="font-heading text-[16px] font-semibold text-[var(--text-primary)] mb-1">
          {name}
        </h2>

        {/* Subtitle */}
        <p className="text-[12px] text-[var(--text-muted)] mb-3.5 tracking-[0.02em]">
          {subtitle}
        </p>

        {/* Description */}
        <p className="text-[13px] text-[var(--text-secondary)] leading-[1.6] flex-1">
          {description}
        </p>
      </div>

      {/* Stats footer */}
      <div className="flex border-t border-[var(--border)]">
        {Object.entries(stats).map(([key, val], i) => (
          <div
            key={key}
            className={`flex-1 py-[18px] text-center
                       ${i < Object.keys(stats).length - 1 ? 'border-r border-[var(--border)]' : ''}`}
          >
            <div
              className="text-[14px] font-semibold leading-none mb-[3px]"
              style={{ color: isActive ? accent : 'var(--text-muted)' }}
            >
              {val}
            </div>
            <div className="text-[11px] text-[var(--text-muted)]">
              {key === 'stations' ? 'Estações' : key === 'types' ? 'Tipos' : 'Fonte'}
            </div>
          </div>
        ))}
      </div>
    </div>
  );

  if (isActive) {
    return <a href={href} className="no-underline block h-full">{content}</a>;
  }
  return content;
}
