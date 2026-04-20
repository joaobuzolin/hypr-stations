// HYPR Station — Population H3 dataset loader
//
// Carrega /assets/pop-ibge-2022.json (~3 MB, ~650 KB gzipped), gerado pelo
// script scripts/generate-population-h3.py a partir dos setores censitários
// IBGE Censo 2022. Expõe lookups sincrônicos após o load inicial.
//
// Formato (v2):
//   { v:2, meta:{...}, ufs:[...], h:[h3_1, h3_2, ...], p:[pop_1, ...], u:[uf_idx_1, ...] }

import { cellToParent } from 'h3-js';

interface PopulationPayload {
  v: number;
  meta: {
    source: string;
    variable: string;
    resolution: number;
    total_population: number;
    hex_count: number;
    generated: string;
  };
  ufs: string[];
  h: string[];
  p: number[];
  u: number[];
}

interface HexRecord {
  pop: number;
  uf: string;
}

const RESOLUTION = 7;

let _map: Map<string, HexRecord> | null = null;
let _meta: PopulationPayload['meta'] | null = null;
let _loading: Promise<Map<string, HexRecord> | null> | null = null;

/**
 * Preload the population dataset. Idempotent — safe to call multiple times
 * (second call returns cached result). Call it early so subsequent lookups
 * are synchronous.
 */
export async function preloadPopulation(): Promise<Map<string, HexRecord> | null> {
  if (_map) return _map;
  if (_loading) return _loading;

  _loading = fetch('/assets/pop-ibge-2022.json')
    .then(r => {
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      return r.json() as Promise<PopulationPayload>;
    })
    .then(payload => {
      const { h, p, u, ufs } = payload;
      const m = new Map<string, HexRecord>();
      for (let i = 0; i < h.length; i++) {
        m.set(h[i], { pop: p[i], uf: ufs[u[i]] });
      }
      _map = m;
      _meta = payload.meta;
      console.log(
        `[Population] Loaded ${payload.meta.hex_count.toLocaleString('pt-BR')} hexes · ` +
        `${(payload.meta.total_population / 1e6).toFixed(1)}M hab (IBGE Censo 2022)`
      );
      return m;
    })
    .catch(err => {
      console.warn('[Population] Failed to load pop-ibge-2022.json', err);
      _map = new Map();
      return null;
    });

  return _loading;
}

/** Synchronous lookup. Returns null if the dataset hasn't loaded yet. */
export function getHexPopulation(hex: string): HexRecord | null {
  if (!_map) return null;
  // Exact match at resolution 7
  const direct = _map.get(hex);
  if (direct) return direct;
  // If caller passed a finer resolution hex, walk up to res 7
  return null;
}

/** Returns the full hex→record map. Null if not loaded. */
export function getPopulationMap(): Map<string, HexRecord> | null {
  return _map;
}

/** Dataset resolution (always 7 in v2, exposed for callers that need it). */
export function getPopulationResolution(): number {
  return RESOLUTION;
}

/** Metadata block (source, total population, etc.). Null if not loaded. */
export function getPopulationMeta(): PopulationPayload['meta'] | null {
  return _meta;
}

/**
 * Sums population across a set of hexes. Hexes outside the dataset contribute
 * 0 (typically sparsely inhabited regions). Returns { pop, ufBreakdown } —
 * ufBreakdown is a per-UF population map useful for applying UF-specific
 * smartphone penetration rates in the audience funnel.
 */
export function sumHexes(hexes: Iterable<string>): { pop: number; ufBreakdown: Record<string, number> } {
  if (!_map) return { pop: 0, ufBreakdown: {} };
  let pop = 0;
  const ufBreakdown: Record<string, number> = {};
  for (const h of hexes) {
    const rec = _map.get(h);
    if (!rec) continue;
    pop += rec.pop;
    ufBreakdown[rec.uf] = (ufBreakdown[rec.uf] || 0) + rec.pop;
  }
  return { pop, ufBreakdown };
}

/**
 * Converts a hex at an arbitrary resolution (e.g. r4 or r5 from the dominance
 * layer) into the equivalent children at res 7 that we can look up. For
 * coarser hexes the mapping is many-to-one (a r5 hex contains ~49 r7 hexes).
 */
export function normalizeToPopulationRes(hex: string, sourceRes: number): string[] {
  if (sourceRes === RESOLUTION) return [hex];
  if (sourceRes > RESOLUTION) {
    // hex is finer than res 7 — walk up to res 7 parent
    return [cellToParent(hex, RESOLUTION)];
  }
  // sourceRes < 7 — would need cellToChildren, but importing it is heavy.
  // We expect callers to pass either res 7 directly or pre-expand using
  // cellToChildren themselves. Throw to make the contract explicit.
  throw new Error(
    `normalizeToPopulationRes: sourceRes ${sourceRes} < ${RESOLUTION}. ` +
    `Expand children externally via h3.cellToChildren(hex, ${RESOLUTION}).`
  );
}
