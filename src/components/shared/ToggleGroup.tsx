interface ToggleOption { value: string; label: string; color?: string; }
interface ToggleGroupProps { label?: string; options: ToggleOption[]; active: Set<string>; onChange: (active: Set<string>) => void; }

export default function ToggleGroup({ label, options, active, onChange }: ToggleGroupProps) {
  const toggle = (v: string) => { const n = new Set(active); n.has(v) ? n.delete(v) : n.add(v); onChange(n); };
  return (
    <div role="group" aria-label={label || 'Toggle'} className="flex gap-2">
      {options.map(opt => {
        const on = active.has(opt.value);
        const c = opt.color || 'var(--accent)';
        return (
          <button key={opt.value} type="button" role="switch" aria-checked={on} onClick={() => toggle(opt.value)}
            className="flex-1 h-8 rounded-lg text-[11px] font-semibold tracking-wide transition-all duration-150 cursor-pointer border"
            style={on ? { background: c + '18', borderColor: c, color: c } : { background: 'transparent', borderColor: 'var(--border)', color: 'var(--text-muted)' }}>
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}
