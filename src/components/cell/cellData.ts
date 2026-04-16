import { supabase } from '../../lib/supabase';

// ─── Types ───────────────────────────────────────
export interface ERB {
  id: number;
  prestadora_norm: string;
  num_estacao: string;
  uf: string;
  municipio: string;
  cod_municipio: number | null;
  logradouro: string | null;
  lat: number;
  lng: number;
  coord_source: string;
  tecnologias: string[];
  tech_principal: string;
  freq_mhz?: number[];
  faixas?: string[];
  azimutes?: number[];
}

// ─── Fetch all ERBs (parallel pagination) ────────
let _cache: ERB[] | null = null;

export async function fetchERBs(onProgress?: (loaded: number) => void): Promise<ERB[]> {
  if (_cache) return _cache;

  // Light columns for map — skip logradouro, azimutes, emissoes for speed
  const cols = 'id,prestadora_norm,num_estacao,uf,municipio,cod_municipio,lat,lng,coord_source,tecnologias,tech_principal';
  const pageSize = 1000; // PostgREST max_rows default

  // First, get total count
  const { count } = await supabase
    .from('erb')
    .select('id', { count: 'exact', head: true });

  const total = count || 0;
  if (total === 0) return [];

  const pages = Math.ceil(total / pageSize);
  const chunks: ERB[][] = new Array(pages).fill(null);
  let loaded = 0;

  // Fetch pages in parallel (6 concurrent — fast but safe)
  const concurrency = 6;
  for (let start = 0; start < pages; start += concurrency) {
    const batch = [];
    for (let i = start; i < Math.min(start + concurrency, pages); i++) {
      const pageIdx = i;
      const from = i * pageSize;
      batch.push(
        supabase
          .from('erb')
          .select(cols)
          .range(from, from + pageSize - 1)
          .order('id')
          .then(({ data, error }) => {
            if (error) {
              console.error('ERB fetch error:', error.message);
              return;
            }
            if (data) {
              chunks[pageIdx] = data as ERB[];
              loaded += data.length;
              onProgress?.(loaded);
            }
          })
      );
    }
    await Promise.all(batch);
  }

  const result = chunks.filter(Boolean).flat();
  _cache = result;
  console.log(`[CellData] Loaded ${result.length} ERBs`);
  return result;
}

// ─── Fetch single ERB detail (on popup) ──────────
export async function fetchERBDetail(id: number): Promise<ERB | null> {
  const { data, error } = await supabase
    .from('erb')
    .select('*')
    .eq('id', id)
    .single();

  if (error || !data) return null;
  return data as ERB;
}

// ─── Derived filter options ──────────────────────
export function getFilterOptions(erbs: ERB[]) {
  const ufs = new Set<string>();
  const operadoras = new Set<string>();
  const faixas = new Set<string>();

  for (const e of erbs) {
    ufs.add(e.uf);
    operadoras.add(e.prestadora_norm);
    if (e.faixas) for (const f of e.faixas) faixas.add(f);
  }

  return {
    ufs: [...ufs].sort(),
    operadoras: [...operadoras].sort(),
    faixas: [...faixas].sort((a, b) => Number(a) - Number(b)),
  };
}

// UF list (fallback for before data loads)
export const ALL_UFS = [
  'AC','AL','AM','AP','BA','CE','DF','ES','GO','MA','MG','MS','MT',
  'PA','PB','PE','PI','PR','RJ','RN','RO','RR','RS','SC','SE','SP','TO',
];
