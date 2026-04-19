import { supabase } from '../../lib/supabase';

export interface ERB {
  id: number;
  prestadora_norm: string;
  num_estacao: string;
  uf: string;
  municipio: string;
  lat: number;
  lng: number;
  tecnologias: string[];
  tech_principal: string;
  // Optional — only available from detail fetch
  cod_municipio?: number | null;
  logradouro?: string | null;
  coord_source?: string;
  freq_mhz?: number[];
  azimutes?: number[];
}

// v4 columnar format — lookup tables + bitmask techs + integer coords
interface ColumnarData {
  v: number;
  meta: { count: number; generated: string; source: string };
  L: { op: string[]; uf: string[]; mun: string[] };
  c: {
    o: number[];  // op index
    n: number[];  // num_estacao (as int)
    u: number[];  // uf index
    m: number[];  // mun index
    a: number[];  // lat * 10000
    g: number[];  // lng * 10000
    t: number[];  // tech bitmask (5G=8 4G=4 3G=2 2G=1)
    p: number[];  // principal tech bitmask
  };
}

const TECH_FROM_BIT: Record<number, string> = { 8: '5G', 4: '4G', 2: '3G', 1: '2G' };

function bitmaskToTechs(mask: number): string[] {
  const out: string[] = [];
  for (const bit of [8, 4, 2, 1]) {
    if (mask & bit) out.push(TECH_FROM_BIT[bit]);
  }
  return out;
}

let _cache: ERB[] | null = null;

export async function fetchERBs(onProgress?: (loaded: number) => void): Promise<ERB[]> {
  if (_cache) return _cache;

  try {
    const resp = await fetch('/assets/erb.json');
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);

    const raw: ColumnarData = await resp.json();
    onProgress?.(raw.meta.count);

    const { op, uf, mun } = raw.L;
    const { o, n, u, m, a, g, t, p } = raw.c;
    const len = raw.meta.count;

    // Expand columnar data to objects
    const erbs: ERB[] = new Array(len);
    for (let i = 0; i < len; i++) {
      erbs[i] = {
        id: i + 1,
        prestadora_norm: op[o[i]],
        num_estacao: String(n[i]),
        uf: uf[u[i]],
        municipio: mun[m[i]],
        lat: a[i] / 10000,
        lng: g[i] / 10000,
        tecnologias: bitmaskToTechs(t[i]),
        tech_principal: TECH_FROM_BIT[p[i]] || '4G',
      };
    }

    _cache = erbs;
    console.log(`[CellData] Loaded ${erbs.length} ERBs from static JSON v4 (${raw.meta.source})`);
    return erbs;
  } catch (err) {
    console.error('[CellData] Static JSON failed, falling back to Supabase:', err);
    return fetchFromSupabase(onProgress);
  }
}

async function fetchFromSupabase(onProgress?: (loaded: number) => void): Promise<ERB[]> {
  const cols = 'id,prestadora_norm,num_estacao,uf,municipio,lat,lng,tecnologias,tech_principal';
  const pageSize = 1000;
  const all: ERB[] = [];
  let from = 0;

  while (true) {
    const { data, error } = await supabase
      .from('erb')
      .select(cols)
      .range(from, from + pageSize - 1)
      .order('id');

    if (error) { console.error('ERB fetch error:', error.message); break; }
    if (!data || data.length === 0) break;
    all.push(...(data as ERB[]));
    onProgress?.(all.length);
    if (data.length < pageSize) break;
    from += pageSize;
  }

  _cache = all;
  console.log(`[CellData] Loaded ${all.length} ERBs from Supabase (fallback)`);
  return all;
}

export async function fetchERBDetail(id: number): Promise<ERB | null> {
  const { data, error } = await supabase
    .from('erb')
    .select('*')
    .eq('id', id)
    .single();

  if (error || !data) return null;
  return data as ERB;
}

export function getFilterOptions(erbs: ERB[]) {
  const ufs = new Set<string>();
  const operadoras = new Set<string>();

  for (const e of erbs) {
    ufs.add(e.uf);
    operadoras.add(e.prestadora_norm);
  }

  return {
    ufs: [...ufs].sort(),
    operadoras: [...operadoras].sort(),
  };
}

// UF list (fallback for before data loads)
export const ALL_UFS = [
  'AC','AL','AM','AP','BA','CE','DF','ES','GO','MA','MG','MS','MT',
  'PA','PB','PE','PI','PR','RJ','RN','RO','RR','RS','SC','SE','SP','TO',
];
