interface ToggleOption {
  value: string;
  label: string;
  color?: string;
}

interface ToggleGroupProps {
  label?: string;
  options: ToggleOption[];
  active: Set<string>;
  onChange: (active: Set<string>) => void;
}

export default function ToggleGroup({ label, options, active, onChange }: ToggleGroupProps) {
  const toggle = (value: string) => {
    const next = new Set(active);
    if (next.has(value)) next.delete(value);
    else next.add(value);
    onChange(next);
  };

  return (
    <div role="group" aria-label={label || 'Toggle options'} className="flex gap-2">
      {options.map((opt) => {
        const isActive = active.has(opt.value);
        const color = opt.color || 'var(--accent)';
        return (
          <button
            key={opt.value}
            type="button"
            role="switch"
            aria-checked={isActive}
            onClick={() => toggle(opt.value)}
            className="flex-1 py-1.5 px-2 rounded-lg border text-xs font-bold tracking-wide
                       transition-all duration-150 cursor-pointer"
            style={isActive ? {
              background: color + '20',
              borderColor: color,
              color: color,
            } : {
              background: 'var(--bg-surface2)',
              borderColor: 'var(--border)',
              color: 'var(--text-muted)',
            }}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}
