interface ToggleOption { value: string; label: string; color?: string; }
interface ToggleGroupProps { label?: string; options: ToggleOption[]; active: Set<string>; onChange: (active: Set<string>) => void; }

export default function ToggleGroup({ label, options, active, onChange }: ToggleGroupProps) {
  const toggle = (v: string) => { const n = new Set(active); n.has(v) ? n.delete(v) : n.add(v); onChange(n); };
  return (
    <div role="group" aria-label={label || 'Toggle'} className="flex gap-1.5">
      {options.map(opt => {
        const on = active.has(opt.value);
        const c = opt.color || 'var(--accent)';
        return (
          <button key={opt.value} type="button" role="switch" aria-checked={on} onClick={() => toggle(opt.value)}
            className="flex-1 h-[34px] rounded-lg text-[12px] font-semibold tracking-[0.01em] transition-all duration-200 cursor-pointer border-[0.5px]"
            style={on
              ? { background: c + '0F', borderColor: c + '40', color: c }
              : { background: 'var(--bg-surface2)', borderColor: 'transparent', color: 'var(--text-muted)' }
            }>
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}
