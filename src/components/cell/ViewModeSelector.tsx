interface Props {
  mode: string;
  onChange: (mode: string) => void;
}

const MODES = [
  { value: 'pins', label: 'ERBs', icon: 'M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z' },
  { value: 'heatmap', label: 'Heatmap', icon: 'M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.42 0-8-3.58-8-8s3.58-8 8-8 8 3.58 8 8-3.58 8-8 8zm0-14c-3.31 0-6 2.69-6 6s2.69 6 6 6 6-2.69 6-6-2.69-6-6-6zm0 10c-2.21 0-4-1.79-4-4s1.79-4 4-4 4 1.79 4 4-1.79 4-4 4z' },
  { value: 'dominance', label: 'Dominância', icon: 'M3 3v18h18M9 17V9l4 4 4-8' },
];

export default function ViewModeSelector({ mode, onChange }: Props) {
  return (
    <div className="absolute top-3.5 left-1/2 -translate-x-1/2 z-10 flex rounded-[10px] overflow-hidden
                    border-[0.5px] border-[var(--border)] overlay-panel"
      role="radiogroup" aria-label="Modo de visualização">
      {MODES.map(m => {
        const on = mode === m.value;
        return (
          <button key={m.value} role="radio" aria-checked={on} onClick={() => onChange(m.value)}
            className={`flex items-center gap-1.5 px-[18px] py-2 text-[11px] font-medium
                        transition-all duration-200 cursor-pointer
                        ${on
                          ? 'bg-[var(--accent-muted)] text-[var(--accent)]'
                          : 'text-[var(--text-muted)] hover:text-[var(--text-secondary)] hover:bg-[rgba(255,255,255,0.03)]'}`}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
              <path d={m.icon} /></svg>
            {m.label}
          </button>
        );
      })}
    </div>
  );
}
