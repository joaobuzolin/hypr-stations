import { useState, useMemo, useCallback } from 'react';
import MultiSelect from '../shared/MultiSelect';
import ToggleGroup from '../shared/ToggleGroup';
import { RADIO_COLORS } from '../../lib/constants';
import { ALL_UFS, ALL_CLASSES, ALL_FINALIDADES, type RadioStation } from './radioData';

interface RadioFiltersProps {
  stations: RadioStation[];
  onFilter: (filtered: RadioStation[]) => void;
}

export interface RadioFilterState {
  types: Set<string>;
  ufs: Set<string>;
  classes: Set<string>;
  finalidades: Set<string>;
  cidade: string;
  entidade: string;
  nome: string;
}

const TYPE_OPTIONS = [
  { value: 'FM', label: 'FM', color: RADIO_COLORS.fm },
  { value: 'OM', label: 'AM/OM', color: RADIO_COLORS.am },
];

export default function RadioFilters({ stations, onFilter }: RadioFiltersProps) {
  const [filters, setFilters] = useState<RadioFilterState>({
    types: new Set(['FM', 'OM']),
    ufs: new Set(),
    classes: new Set(),
    finalidades: new Set(),
    cidade: '',
    entidade: '',
    nome: '',
  });

  const [collapsed, setCollapsed] = useState(false);

  const apply = useCallback((f: RadioFilterState) => {
    const cidadeNorm = f.cidade.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    const entNorm = f.entidade.toLowerCase();
    const nomeNorm = f.nome.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');

    const result = stations.filter((s) => {
      if (!f.types.has(s.tipo)) return false;
      if (f.ufs.size && !f.ufs.has(s.uf)) return false;
      if (cidadeNorm && !s._mun.includes(cidadeNorm)) return false;
      if (f.classes.size && !f.classes.has(s.classe)) return false;
      if (f.finalidades.size && !f.finalidades.has(s.finalidade)) return false;
      if (entNorm && !s._ent.includes(entNorm)) return false;
      if (nomeNorm && !s._nome.includes(nomeNorm)) return false;
      return true;
    });
    onFilter(result);
  }, [stations, onFilter]);

  const update = useCallback((patch: Partial<RadioFilterState>) => {
    setFilters((prev) => {
      const next = { ...prev, ...patch };
      apply(next);
      return next;
    });
  }, [apply]);

  const reset = useCallback(() => {
    const fresh: RadioFilterState = {
      types: new Set(['FM', 'OM']),
      ufs: new Set(),
      classes: new Set(),
      finalidades: new Set(),
      cidade: '',
      entidade: '',
      nome: '',
    };
    setFilters(fresh);
    apply(fresh);
  }, [apply]);

  // Count by type
  const counts = useMemo(() => {
    const fm = stations.filter(s => s.tipo === 'FM').length;
    return { fm, om: stations.length - fm };
  }, [stations]);

  return (
    <div className="flex flex-col border-b border-[var(--border)]">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-3 border-b border-[var(--border)]">
        <h2 className="text-[11px] font-bold uppercase tracking-widest text-[var(--text-muted)]">
          Filtros
        </h2>
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="text-[10px] px-2 py-1 rounded border bg-[var(--bg-surface2)]
                     border-[var(--border)] text-[var(--text-muted)]
                     hover:border-[var(--accent)] hover:text-[var(--accent)]
                     transition-colors cursor-pointer"
        >
          {collapsed ? '▼ Expandir' : '▲ Recolher'}
        </button>
      </div>

      {/* Body */}
      <div
        className={`px-5 py-3 flex flex-col gap-3 transition-all duration-250 overflow-hidden
                    ${collapsed ? 'max-h-0 opacity-0 py-0' : 'max-h-[600px] opacity-100'}`}
      >
        {/* Type toggle */}
        <div className="flex flex-col gap-1">
          <span className="text-[10px] font-medium uppercase tracking-wider text-[var(--text-muted)]">
            Tipo
          </span>
          <ToggleGroup
            options={TYPE_OPTIONS}
            active={filters.types}
            onChange={(types) => update({ types })}
          />
        </div>

        {/* UF */}
        <MultiSelect
          label="Estado (UF)"
          placeholder="Todos os estados"
          options={ALL_UFS}
          selected={filters.ufs}
          onChange={(ufs) => update({ ufs })}
        />

        {/* Cidade */}
        <div className="flex flex-col gap-1">
          <span className="text-[10px] font-medium uppercase tracking-wider text-[var(--text-muted)]">
            Cidade
          </span>
          <input
            type="text"
            value={filters.cidade}
            onChange={(e) => update({ cidade: e.target.value })}
            placeholder="Buscar cidade..."
            className="w-full px-3 py-1.5 rounded-lg text-xs
                       bg-[var(--bg-surface2)] border border-[var(--border)]
                       text-[var(--text-primary)] placeholder:text-[var(--text-muted)]
                       outline-none focus:border-[var(--accent)] transition-colors"
          />
        </div>

        {/* Classe */}
        <MultiSelect
          label="Classe"
          placeholder="Todas as classes"
          options={ALL_CLASSES}
          selected={filters.classes}
          onChange={(classes) => update({ classes })}
        />

        {/* Finalidade */}
        <MultiSelect
          label="Finalidade"
          placeholder="Todas"
          options={ALL_FINALIDADES}
          selected={filters.finalidades}
          onChange={(finalidades) => update({ finalidades })}
          searchable={false}
        />

        {/* Entidade */}
        <div className="flex flex-col gap-1">
          <span className="text-[10px] font-medium uppercase tracking-wider text-[var(--text-muted)]">
            Entidade
          </span>
          <input
            type="text"
            value={filters.entidade}
            onChange={(e) => update({ entidade: e.target.value })}
            placeholder="Buscar entidade..."
            className="w-full px-3 py-1.5 rounded-lg text-xs
                       bg-[var(--bg-surface2)] border border-[var(--border)]
                       text-[var(--text-primary)] placeholder:text-[var(--text-muted)]
                       outline-none focus:border-[var(--accent)] transition-colors"
          />
        </div>

        {/* Nome fantasia */}
        <div className="flex flex-col gap-1">
          <span className="text-[10px] font-medium uppercase tracking-wider text-[var(--text-muted)]">
            Nome da rádio
          </span>
          <input
            type="text"
            value={filters.nome}
            onChange={(e) => update({ nome: e.target.value })}
            placeholder="Jovem Pan, Band, CBN..."
            className="w-full px-3 py-1.5 rounded-lg text-xs
                       bg-[var(--bg-surface2)] border border-[var(--border)]
                       text-[var(--text-primary)] placeholder:text-[var(--text-muted)]
                       outline-none focus:border-[var(--accent)] transition-colors"
          />
        </div>

        {/* Reset */}
        <button
          onClick={reset}
          className="w-full py-2 rounded-lg border text-xs
                     border-[var(--border)] text-[var(--text-muted)]
                     hover:border-[var(--accent)] hover:text-[var(--accent)]
                     transition-colors cursor-pointer"
        >
          ↺ Limpar filtros
        </button>
      </div>
    </div>
  );
}
