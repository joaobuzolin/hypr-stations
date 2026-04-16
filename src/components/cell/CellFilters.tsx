import { useState, useCallback, useId } from 'react';
import MultiSelect from '../shared/MultiSelect';
import ToggleGroup from '../shared/ToggleGroup';
import { OPERADORA_COLORS, TECH_COLORS } from '../../lib/constants';
import type { ERB } from './cellData';

interface Props {
  erbs: ERB[];
  onFilter: (filtered: ERB[]) => void;
  filterOptions: { ufs: string[]; operadoras: string[]; faixas: string[] };
}

export interface CellFilterState {
  techs: Set<string>;
  operadoras: Set<string>;
  ufs: Set<string>;
  faixas: Set<string>;
  cidade: string;
}

const TECH_OPTS = [
  { value: '5G', label: '5G', color: TECH_COLORS['5G'] },
  { value: '4G', label: '4G', color: TECH_COLORS['4G'] },
  { value: '3G', label: '3G', color: TECH_COLORS['3G'] },
  { value: '2G', label: '2G', color: TECH_COLORS['2G'] },
];

const INITIAL: CellFilterState = {
  techs: new Set(['5G', '4G', '3G', '2G']),
  operadoras: new Set(),
  ufs: new Set(),
  faixas: new Set(),
  cidade: '',
};

export default function CellFilters({ erbs, onFilter, filterOptions }: Props) {
  const uid = useId();
  const [f, setF] = useState<CellFilterState>(INITIAL);
  const [advOpen, setAdvOpen] = useState(false);

  const apply = useCallback((fl: CellFilterState) => {
    const cn = fl.cidade.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    onFilter(erbs.filter(e => {
      if (!e.tecnologias.some(t => fl.techs.has(t))) return false;
      if (fl.operadoras.size && !fl.operadoras.has(e.prestadora_norm)) return false;
      if (fl.ufs.size && !fl.ufs.has(e.uf)) return false;
      if (fl.faixas.size && !e.faixas?.some(b => fl.faixas.has(b))) return false;
      if (cn) {
        const mun = e.municipio.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
        if (!mun.includes(cn)) return false;
      }
      return true;
    }));
  }, [erbs, onFilter]);

  const upd = useCallback((p: Partial<CellFilterState>) => {
    setF(prev => { const n = { ...prev, ...p }; apply(n); return n; });
  }, [apply]);

  const reset = useCallback(() => {
    setF(INITIAL);
    apply(INITIAL);
  }, [apply]);

  return (
    <div className="flex flex-col shrink-0 min-w-0 overflow-hidden">
      {/* Technology */}
      <section className="px-4 py-4 border-b border-[var(--border)] min-w-0">
        <div className="text-[11px] font-medium tracking-[0.03em] text-[var(--text-muted)] mb-2.5">Tecnologia</div>
        <ToggleGroup label="Tecnologia" options={TECH_OPTS} active={f.techs} onChange={techs => upd({ techs })} />
      </section>

      {/* Operators */}
      <section className="px-4 py-4 border-b border-[var(--border)] min-w-0">
        <div className="text-[11px] font-medium tracking-[0.03em] text-[var(--text-muted)] mb-2.5">Operadora</div>
        <div className="flex flex-wrap gap-1.5">
          {filterOptions.operadoras.map(op => {
            const on = f.operadoras.size === 0 || f.operadoras.has(op);
            const c = OPERADORA_COLORS[op] || OPERADORA_COLORS['Outras'];
            return (
              <button key={op} type="button" onClick={() => {
                if (f.operadoras.size === 0) {
                  upd({ operadoras: new Set([op]) });
                } else {
                  const n = new Set(f.operadoras);
                  n.has(op) ? n.delete(op) : n.add(op);
                  upd({ operadoras: n.size === filterOptions.operadoras.length ? new Set() : n });
                }
              }}
                className="flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-medium transition-all duration-200 cursor-pointer"
                style={on
                  ? { color: c, background: c + '12', border: `1px solid ${c}40` }
                  : { color: 'var(--text-faint)', background: 'transparent', border: '1px solid var(--input-border-subtle)' }
                }>
                <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: on ? c : 'var(--text-faint)' }} />
                {op}
              </button>
            );
          })}
        </div>
      </section>

      {/* Advanced */}
      <section className="px-4 py-4 border-b border-[var(--border)] min-w-0">
        <button
          type="button"
          onClick={() => setAdvOpen(!advOpen)}
          style={{ background: 'none', border: 'none', padding: 0, font: 'inherit' }}
          className="flex items-center justify-between w-full cursor-pointer outline-none"
        >
          <span className="text-[11px] font-medium tracking-[0.03em] text-[var(--text-muted)]">
            Filtros avançados
          </span>
          <svg width="10" height="6" viewBox="0 0 10 6" fill="none" stroke="var(--text-faint)"
            strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"
            className={`transition-transform duration-200 ${advOpen ? 'rotate-180' : ''}`}>
            <path d="M1 1l4 4 4-4" />
          </svg>
        </button>

        {advOpen && (
          <div className="flex flex-col gap-4 mt-4 min-w-0">
            <MultiSelect label="Estado (UF)" placeholder="Todos os estados" options={filterOptions.ufs}
              selected={f.ufs} onChange={ufs => upd({ ufs })} />

            <div className="min-w-0">
              <label htmlFor={`cc-${uid}`} className="block text-[11px] font-medium tracking-[0.03em] text-[var(--text-muted)] mb-1.5">Cidade</label>
              <input id={`cc-${uid}`} value={f.cidade} onChange={e => upd({ cidade: e.target.value })}
                placeholder="Buscar município..."
                style={{ background: 'var(--input-bg)', border: '1px solid var(--input-border)', boxSizing: 'border-box' }}
                className="block w-full max-w-full h-8 px-3 rounded-md text-[12px] text-[var(--text-primary)] placeholder:text-[var(--text-faint)] outline-none focus:border-[var(--accent)] transition-colors duration-200" />
            </div>

            <MultiSelect label="Faixa (MHz)" placeholder="Todas" options={filterOptions.faixas}
              selected={f.faixas} onChange={faixas => upd({ faixas })} searchable={false} />

            <button onClick={reset} type="button"
              style={{ background: 'none', border: '1px solid var(--input-border-subtle)', boxSizing: 'border-box' }}
              className="block w-full max-w-full h-8 rounded-md text-[11px] font-medium text-[var(--accent)]
                         hover:border-[var(--accent)] cursor-pointer transition-colors duration-200">
              Limpar filtros
            </button>
          </div>
        )}
      </section>
    </div>
  );
}
