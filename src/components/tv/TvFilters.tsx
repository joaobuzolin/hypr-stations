import { useState, useCallback, useId, useMemo } from 'react';
import MultiSelect from '../shared/MultiSelect';
import ToggleGroup from '../shared/ToggleGroup';
import { TV_NETWORK_COLORS, TV_NETWORK_NAMES, TV_NETWORK_ORDER, TV_TYPE_COLORS } from '../../lib/constants';
import type { TvStation } from './tvData';

interface Props {
  stations: TvStation[];
  onFilter: (f: TvStation[]) => void;
  allUFs: string[];
  allRedes: string[];
  allStatus: string[];
  onRequestRtv?: () => void;
  rtvLoaded: boolean;
}

interface TvFilterState {
  types: Set<string>;
  redes: Set<string>;
  ufs: Set<string>;
  status: Set<string>;
  cidade: string;
  entidade: string;
  canal: string;
}

const TYPE_OPTS = [
  { value: 'TVD', label: 'Geradoras', color: TV_TYPE_COLORS.tvd },
  { value: 'RTV', label: 'Retransmissoras', color: '#7a6e64' },
];

export default function TvFilters({
  stations, onFilter, allUFs, allRedes, allStatus, onRequestRtv, rtvLoaded,
}: Props) {
  const uid = useId();
  const [f, setF] = useState<TvFilterState>({
    types: new Set(['TVD']),
    redes: new Set(),
    ufs: new Set(),
    status: new Set(),
    cidade: '',
    entidade: '',
    canal: '',
  });
  const [advOpen, setAdvOpen] = useState(false);

  const apply = useCallback((fl: TvFilterState) => {
    const cn = fl.cidade.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    const en = fl.entidade.toLowerCase();
    const ch = fl.canal.trim();

    onFilter(stations.filter(s => {
      if (fl.types.size) {
        const wantsTvd = fl.types.has('TVD');
        const wantsRtv = fl.types.has('RTV');
        if (s.tipo === 'TVD' && !wantsTvd) return false;
        if (s.tipo !== 'TVD' && !wantsRtv) return false;
      }
      if (fl.redes.size && !fl.redes.has(s.rede_id)) return false;
      if (fl.ufs.size && !fl.ufs.has(s.uf)) return false;
      if (fl.status.size && !fl.status.has(s.status)) return false;
      if (cn && !s._mun.includes(cn)) return false;
      if (en && !s._ent.includes(en) && !s._fantasy.includes(en)) return false;
      if (ch && !s.canal.startsWith(ch) && !s.canal_virtual.startsWith(ch)) return false;
      return true;
    }));
  }, [stations, onFilter]);

  const upd = useCallback((p: Partial<TvFilterState>) => {
    setF(prev => {
      const n = { ...prev, ...p };
      if (p.types && p.types.has('RTV') && !rtvLoaded && onRequestRtv) {
        onRequestRtv();
      }
      apply(n);
      return n;
    });
  }, [apply, rtvLoaded, onRequestRtv]);

  const reset = useCallback(() => {
    const fresh: TvFilterState = {
      types: new Set(['TVD']),
      redes: new Set(),
      ufs: new Set(),
      status: new Set(),
      cidade: '',
      entidade: '',
      canal: '',
    };
    setF(fresh);
    apply(fresh);
  }, [apply]);

  const orderedRedes = useMemo(() => {
    const set = new Set(allRedes);
    return TV_NETWORK_ORDER.filter(r => set.has(r));
  }, [allRedes]);

  return (
    <div className="flex flex-col shrink-0 min-w-0 overflow-hidden">
      <section className="px-4 py-4 border-b border-[var(--border)] min-w-0">
        <div className="text-[11px] font-medium tracking-[0.03em] text-[var(--text-muted)] mb-2.5">Tipo</div>
        <ToggleGroup label="Tipo" options={TYPE_OPTS} active={f.types} onChange={types => upd({ types })} />
        {f.types.has('RTV') && !rtvLoaded && (
          <div className="text-[10px] text-[var(--text-muted)] mt-2">
            Carregando retransmissoras…
          </div>
        )}
      </section>

      {orderedRedes.length > 0 && (
        <section className="px-4 py-4 border-b border-[var(--border)] min-w-0">
          <div className="text-[11px] font-medium tracking-[0.03em] text-[var(--text-muted)] mb-2.5">Rede</div>
          <div className="flex flex-wrap gap-1.5">
            {orderedRedes.map(r => {
              const on = f.redes.has(r);
              const color = TV_NETWORK_COLORS[r] || TV_NETWORK_COLORS.outras;
              return (
                <button
                  key={r}
                  type="button"
                  onClick={() => {
                    const n = new Set(f.redes);
                    if (n.has(r)) n.delete(r); else n.add(r);
                    upd({ redes: n });
                  }}
                  className="text-[10px] font-medium px-2 py-[3px] rounded-full cursor-pointer
                             transition-all duration-150 outline-none
                             focus-visible:ring-1 focus-visible:ring-[var(--accent)]"
                  style={{
                    background: on ? color + '26' : 'rgba(255,255,255,0.02)',
                    color: on ? color : 'var(--text-muted)',
                    border: `0.5px solid ${on ? color + '66' : 'var(--input-border-subtle)'}`,
                  }}
                >
                  {TV_NETWORK_NAMES[r] || r}
                </button>
              );
            })}
          </div>
        </section>
      )}

      <section className="px-4 py-4 border-b border-[var(--border)] min-w-0">
        <MultiSelect label="Estado (UF)" placeholder="Todos os estados" options={allUFs}
          selected={f.ufs} onChange={ufs => upd({ ufs })} />
      </section>

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
            <div className="flex flex-col gap-1.5 min-w-0">
              <label htmlFor={`c-${uid}`} className="text-[11px] font-medium tracking-[0.03em] text-[var(--text-muted)]">Cidade</label>
              <input id={`c-${uid}`} value={f.cidade} onChange={e => upd({ cidade: e.target.value })}
                placeholder="Buscar cidade..."
                className="w-full h-8 px-3 rounded-md box-border border-solid text-[12px] text-[var(--text-primary)] placeholder:text-[var(--text-faint)] outline-none focus:border-[var(--accent)] transition-colors duration-200 bg-[var(--input-bg)] border border-[var(--input-border)]" />
            </div>

            <div className="flex flex-col gap-1.5 min-w-0">
              <label htmlFor={`e-${uid}`} className="text-[11px] font-medium tracking-[0.03em] text-[var(--text-muted)]">Entidade ou nome fantasia</label>
              <input id={`e-${uid}`} value={f.entidade} onChange={e => upd({ entidade: e.target.value })}
                placeholder="TV Globo SP, Rede Record..."
                className="w-full h-8 px-3 rounded-md box-border border-solid text-[12px] text-[var(--text-primary)] placeholder:text-[var(--text-faint)] outline-none focus:border-[var(--accent)] transition-colors duration-200 bg-[var(--input-bg)] border border-[var(--input-border)]" />
            </div>

            <div className="flex flex-col gap-1.5 min-w-0">
              <label htmlFor={`ch-${uid}`} className="text-[11px] font-medium tracking-[0.03em] text-[var(--text-muted)]">Canal</label>
              <input id={`ch-${uid}`} value={f.canal} onChange={e => upd({ canal: e.target.value })}
                placeholder="Ex: 13, 5.1, 42..."
                className="w-full h-8 px-3 rounded-md box-border border-solid text-[12px] text-[var(--text-primary)] placeholder:text-[var(--text-faint)] outline-none focus:border-[var(--accent)] transition-colors duration-200 bg-[var(--input-bg)] border border-[var(--input-border)]" />
            </div>

            {allStatus.length > 0 && (
              <MultiSelect label="Status" placeholder="Todos" options={allStatus}
                selected={f.status} onChange={status => upd({ status })} searchable={false} />
            )}

            <button onClick={reset} type="button"
              className="w-full h-8 rounded-md box-border border-solid text-[11px] font-medium text-[var(--accent)]
                         hover:border-[var(--accent)] cursor-pointer transition-colors duration-200 bg-transparent border border-[var(--input-border-subtle)]">
              Limpar filtros
            </button>
          </div>
        )}
      </section>
    </div>
  );
}
