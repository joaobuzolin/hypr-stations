import { useState, useCallback, useId } from 'react';
import MultiSelect from '../shared/MultiSelect';
import ToggleGroup from '../shared/ToggleGroup';
import { RADIO_COLORS } from '../../lib/constants';
import { ALL_UFS, ALL_CLASSES, ALL_FINALIDADES, type RadioStation } from './radioData';

interface Props { stations: RadioStation[]; onFilter: (f: RadioStation[]) => void; }

export interface RadioFilterState {
  types: Set<string>; ufs: Set<string>; classes: Set<string>; finalidades: Set<string>;
  cidade: string; entidade: string; nome: string;
}

const TYPE_OPTS = [
  { value: 'FM', label: 'FM', color: RADIO_COLORS.fm },
  { value: 'OM', label: 'AM/OM', color: RADIO_COLORS.am },
];

const labelCls = "text-[11px] font-semibold uppercase tracking-[0.04em] text-[var(--text-muted)]";
const inputCls = "w-full h-8 px-2.5 rounded-lg text-[12px] bg-[var(--bg-surface2)] border border-[var(--border)] text-[var(--text-primary)] placeholder:text-[var(--text-muted)] outline-none focus:border-[var(--accent)] transition-colors";

export default function RadioFilters({ stations, onFilter }: Props) {
  const uid = useId();
  const [f, setF] = useState<RadioFilterState>({
    types: new Set(['FM', 'OM']), ufs: new Set(), classes: new Set(), finalidades: new Set(),
    cidade: '', entidade: '', nome: '',
  });
  const [collapsed, setCollapsed] = useState(false);

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
    <div className="flex flex-col border-b border-[var(--border)] shrink-0">
      <div className="flex items-center justify-between px-4 h-10 border-b border-[var(--border)]">
        <span className="text-[11px] font-bold uppercase tracking-[0.06em] text-[var(--text-muted)]">Filtros</span>
        <button onClick={() => setCollapsed(!collapsed)} aria-expanded={!collapsed}
          className="text-[10px] text-[var(--text-muted)] hover:text-[var(--accent)] cursor-pointer transition-colors">
          {collapsed ? '▼ Expandir' : '▲ Recolher'}</button>
      </div>
      <div className={`px-4 py-3 flex flex-col gap-3 transition-all duration-200 overflow-hidden ${collapsed ? 'max-h-0 opacity-0 !py-0' : 'max-h-[700px] opacity-100'}`}>
        <div className="flex flex-col gap-1.5">
          <span className={labelCls}>Tipo</span>
          <ToggleGroup label="Tipo" options={TYPE_OPTS} active={f.types} onChange={types => upd({ types })} />
        </div>
        <MultiSelect label="Estado (UF)" placeholder="Todos os estados" options={ALL_UFS} selected={f.ufs} onChange={ufs => upd({ ufs })} />
        <div className="flex flex-col gap-1.5">
          <label htmlFor={`c-${uid}`} className={labelCls}>Cidade</label>
          <input id={`c-${uid}`} value={f.cidade} onChange={e => upd({ cidade: e.target.value })} placeholder="Buscar cidade..." className={inputCls} />
        </div>
        <MultiSelect label="Classe" placeholder="Todas as classes" options={ALL_CLASSES} selected={f.classes} onChange={classes => upd({ classes })} />
        <MultiSelect label="Finalidade" placeholder="Todas" options={ALL_FINALIDADES} selected={f.finalidades} onChange={finalidades => upd({ finalidades })} searchable={false} />
        <div className="flex flex-col gap-1.5">
          <label htmlFor={`e-${uid}`} className={labelCls}>Entidade</label>
          <input id={`e-${uid}`} value={f.entidade} onChange={e => upd({ entidade: e.target.value })} placeholder="Buscar entidade..." className={inputCls} />
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor={`n-${uid}`} className={labelCls}>Nome da rádio</label>
          <input id={`n-${uid}`} value={f.nome} onChange={e => upd({ nome: e.target.value })} placeholder="Jovem Pan, Band, CBN..." className={inputCls} />
        </div>
        <button onClick={reset} className="text-[11px] text-[var(--text-muted)] hover:text-[var(--accent)] cursor-pointer transition-colors py-1">
          ↺ Limpar filtros</button>
      </div>
    </div>
  );
}
