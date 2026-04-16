import { useState, useCallback, useId } from 'react';
import MultiSelect from '../shared/MultiSelect';
import ToggleGroup from '../shared/ToggleGroup';
import { RADIO_COLORS } from '../../lib/constants';
import type { RadioStation } from './radioData';

interface Props {
  stations: RadioStation[];
  onFilter: (f: RadioStation[]) => void;
  allUFs: string[];
  allClasses: string[];
  allFinalidades: string[];
}

interface RadioFilterState {
  types: Set<string>; ufs: Set<string>; classes: Set<string>; finalidades: Set<string>;
  cidade: string; entidade: string; nome: string;
}

const TYPE_OPTS = [
  { value: 'FM', label: 'FM', color: RADIO_COLORS.fm },
  { value: 'OM', label: 'AM/OM', color: RADIO_COLORS.am },
];

export default function RadioFilters({ stations, onFilter, allUFs, allClasses, allFinalidades }: Props) {
  const uid = useId();
  const [f, setF] = useState<RadioFilterState>({
    types: new Set(['FM', 'OM']), ufs: new Set(), classes: new Set(), finalidades: new Set(),
    cidade: '', entidade: '', nome: '',
  });
  const [advOpen, setAdvOpen] = useState(false);

  const apply = useCallback((fl: RadioFilterState) => {
    const cn = fl.cidade.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    const en = fl.entidade.toLowerCase();
    const nn = fl.nome.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    onFilter(stations.filter(s => {
      if (!fl.types.has(s.tipo)) return false;
      if (fl.ufs.size && !fl.ufs.has(s.uf)) return false;
      if (cn && !s._mun.includes(cn)) return false;
      if (fl.classes.size && !fl.classes.has(s.classe)) return false;
      if (fl.finalidades.size && !fl.finalidades.has(s.finalidade)) return false;
      if (en && !s._ent.includes(en)) return false;
      if (nn && !s._nome.includes(nn)) return false;
      return true;
    }));
  }, [stations, onFilter]);

  const upd = useCallback((p: Partial<RadioFilterState>) => {
    setF(prev => { const n = { ...prev, ...p }; apply(n); return n; });
  }, [apply]);

  const reset = useCallback(() => {
    const fresh: RadioFilterState = { types: new Set(['FM', 'OM']), ufs: new Set(), classes: new Set(), finalidades: new Set(), cidade: '', entidade: '', nome: '' };
    setF(fresh); apply(fresh);
  }, [apply]);

  return (
    <div className="flex flex-col shrink-0 min-w-0 overflow-hidden">
      {/* Type */}
      <section className="px-4 py-4 border-b border-[var(--border)] min-w-0">
        <div className="text-[11px] font-medium tracking-[0.03em] text-[var(--text-muted)] mb-2.5">Tipo</div>
        <ToggleGroup label="Tipo" options={TYPE_OPTS} active={f.types} onChange={types => upd({ types })} />
      </section>

      {/* UF */}
      <section className="px-4 py-4 border-b border-[var(--border)] min-w-0">
        <MultiSelect label="Estado (UF)" placeholder="Todos os estados" options={allUFs}
          selected={f.ufs} onChange={ufs => upd({ ufs })} />
      </section>

      {/* Advanced */}
      <section className="px-4 py-4 border-b border-[var(--border)] min-w-0">
        <button
          type="button"
          onClick={() => setAdvOpen(!advOpen)}
          className="flex items-center justify-between w-full cursor-pointer outline-none focus-visible:ring-1 focus-visible:ring-[var(--accent)] rounded bg-transparent border-none p-0 font-[inherit]"
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
            <div className="min-w-0">
              <label htmlFor={`c-${uid}`} className="block text-[11px] font-medium tracking-[0.03em] text-[var(--text-muted)] mb-1.5">Cidade</label>
              <input id={`c-${uid}`} value={f.cidade} onChange={e => upd({ cidade: e.target.value })}
                placeholder="Buscar cidade..."
                className="block w-full h-8 px-3 rounded-md text-[12px] text-[var(--text-primary)] placeholder:text-[var(--text-faint)] outline-none focus:border-[var(--accent)] transition-colors duration-200 bg-[var(--input-bg)] border border-[var(--input-border)]" />
            </div>

            <MultiSelect label="Classe" placeholder="Todas as classes" options={allClasses}
              selected={f.classes} onChange={classes => upd({ classes })} />

            <MultiSelect label="Finalidade" placeholder="Todas" options={allFinalidades}
              selected={f.finalidades} onChange={finalidades => upd({ finalidades })} searchable={false} />

            <div className="min-w-0">
              <label htmlFor={`e-${uid}`} className="block text-[11px] font-medium tracking-[0.03em] text-[var(--text-muted)] mb-1.5">Entidade</label>
              <input id={`e-${uid}`} value={f.entidade} onChange={e => upd({ entidade: e.target.value })}
                placeholder="Buscar entidade..."
                className="block w-full h-8 px-3 rounded-md text-[12px] text-[var(--text-primary)] placeholder:text-[var(--text-faint)] outline-none focus:border-[var(--accent)] transition-colors duration-200 bg-[var(--input-bg)] border border-[var(--input-border)]" />
            </div>

            <div className="min-w-0">
              <label htmlFor={`n-${uid}`} className="block text-[11px] font-medium tracking-[0.03em] text-[var(--text-muted)] mb-1.5">Nome da rádio</label>
              <input id={`n-${uid}`} value={f.nome} onChange={e => upd({ nome: e.target.value })}
                placeholder="Jovem Pan, Band, CBN..."
                className="block w-full h-8 px-3 rounded-md text-[12px] text-[var(--text-primary)] placeholder:text-[var(--text-faint)] outline-none focus:border-[var(--accent)] transition-colors duration-200 bg-[var(--input-bg)] border border-[var(--input-border)]" />
            </div>

            <button onClick={reset} type="button"
              className="block w-full h-8 rounded-md text-[11px] font-medium text-[var(--accent)]
                         hover:border-[var(--accent)] cursor-pointer transition-colors duration-200 bg-transparent border border-[var(--input-border-subtle)]">
              Limpar filtros
            </button>
          </div>
        )}
      </section>
    </div>
  );
}
