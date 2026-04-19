import type { Map as MLMap } from 'maplibre-gl';
import { cellToBoundary, cellToLatLng, latLngToCell } from 'h3-js';
import { OPERADORA_COLORS } from '../../lib/constants';
import type { ERB } from './cellData';


const HEATMAP_SOURCE = 'erb-heatmap';
const HEATMAP_LAYER = 'erb-heatmap-layer';

export function addHeatmapLayer(map: MLMap, erbs: ERB[]) {
  removeHeatmapLayer(map);
  const geojson: GeoJSON.FeatureCollection = {
    type: 'FeatureCollection',
    features: erbs.filter(e => e.lat && e.lng).map(e => ({
      type: 'Feature', geometry: { type: 'Point', coordinates: [e.lng, e.lat] }, properties: { weight: 1 },
    })),
  };
  map.addSource(HEATMAP_SOURCE, { type: 'geojson', data: geojson });
  map.addLayer({
    id: HEATMAP_LAYER, type: 'heatmap', source: HEATMAP_SOURCE,
    paint: {
      // Low weight at low zoom to avoid saturation with 109K points
      'heatmap-weight': ['interpolate', ['linear'], ['zoom'], 0, 0.08, 6, 0.3, 10, 0.7, 14, 1],
      // Gentle intensity — let density do the work
      'heatmap-intensity': ['interpolate', ['linear'], ['zoom'], 0, 0.2, 5, 0.4, 8, 0.8, 12, 1.5],
      'heatmap-color': [
        'interpolate', ['linear'], ['heatmap-density'],
        0, 'rgba(0,0,0,0)',
        0.05, 'rgba(33,102,172,0.15)',
        0.15, 'rgba(33,102,172,0.35)',
        0.3, 'rgba(51,151,185,0.5)',
        0.5, 'rgba(102,194,165,0.6)',
        0.7, 'rgba(237,217,0,0.7)',
        0.85, 'rgba(245,100,43,0.8)',
        1, 'rgba(220,30,38,0.85)',
      ],
      // Tight radius at country zoom, expanding at city zoom
      'heatmap-radius': ['interpolate', ['linear'], ['zoom'], 0, 2, 4, 4, 6, 8, 8, 16, 10, 30, 13, 50],
      'heatmap-opacity': ['interpolate', ['linear'], ['zoom'], 13, 0.85, 16, 0.2],
    },
  });
}

export function removeHeatmapLayer(map: MLMap) {
  if (map.getLayer(HEATMAP_LAYER)) map.removeLayer(HEATMAP_LAYER);
  if (map.getSource(HEATMAP_SOURCE)) map.removeSource(HEATMAP_SOURCE);
}


const DOM_SOURCE = 'erb-dominance';
const DOM_FILL = 'erb-dominance-fill';
const DOM_LINE = 'erb-dominance-line';
const DOM_LABEL = 'erb-dominance-label';

export interface HexRaw {
  h: string;           // h3 index
  c: number[][];       // coordinates ring [lng, lat]
  d: string;           // dominant operator
  p: number;           // dominant pct (0-100)
  t: number;           // total ERBs
  o: Record<string, number>; // per-operator counts
}

// v2 compact format: [h3, dom_op_idx, pct, total, [op_idx, count, ...]]
type CompactHex = [string, number, number, number, number[]];

interface CompactDominanceData {
  v: number;
  meta: { generated: string; source: string; totalErbs: number; resolutions: number[] };
  ops: string[];
  all: Record<string, CompactHex[]>;
  '5G': Record<string, CompactHex[]>;
  '4G': Record<string, CompactHex[]>;
}

interface DominanceData {
  meta: { generated: string; source: string; totalErbs: number; resolutions: number[] };
  all: Record<string, HexRaw[]>;
  '5G': Record<string, HexRaw[]>;
  '4G': Record<string, HexRaw[]>;
}

// h3 boundary cache — avoids recomputing for the same hex across tech filters
const _boundaryCache = new Map<string, number[][]>();

function h3ToRing(h3Index: string): number[][] {
  let ring = _boundaryCache.get(h3Index);
  if (ring) return ring;
  // cellToBoundary returns [lat, lng][] — we need [lng, lat][] for GeoJSON
  const boundary = cellToBoundary(h3Index);
  ring = boundary.map(([lat, lng]) => [lng, lat]);
  ring.push(ring[0]); // close the ring
  _boundaryCache.set(h3Index, ring);
  return ring;
}

function expandHexes(compact: CompactHex[], ops: string[]): HexRaw[] {
  return compact.map(([h, dIdx, p, t, oFlat]) => {
    const o: Record<string, number> = {};
    for (let i = 0; i < oFlat.length; i += 2) {
      o[ops[oFlat[i]]] = oFlat[i + 1];
    }
    return { h, c: h3ToRing(h), d: ops[dIdx], p, t, o };
  });
}

let _domData: DominanceData | null = null;
let _domLoading: Promise<DominanceData | null> | null = null;

// ERBs injected by CellMap — needed for runtime hex computation at r6/r7
let _erbsForDominance: ERB[] | null = null;

// Runtime hex cache keyed by `${techFilter}-r${resolution}`. Cleared when
// ERBs change (i.e. only after full reload of erb.json).
const _runtimeHexes: Map<string, HexRaw[]> = new Map();

export function setErbsForDominance(erbs: ERB[]): void {
  _erbsForDominance = erbs;
  _runtimeHexes.clear();
}

// Unified resolution picker. Lower number = bigger hex; higher = finer detail.
// Approx hex edge length: r3=25km, r4=10km, r5=4km, r6=1.5km, r7=600m
export function getResolutionForZoom(zoom: number): number {
  if (zoom < 6) return 3;
  if (zoom < 8) return 4;
  if (zoom < 10) return 5;
  if (zoom < 12) return 6;
  return 7;
}

export function getResKeyForZoom(zoom: number): string {
  return `r${getResolutionForZoom(zoom)}`;
}

// Compute hexagons at an arbitrary resolution from raw ERB data.
// Used when resolution > 5 (not pre-computed in dominance.json).
function computeRuntimeHexes(techFilter: 'all' | '5G' | '4G', resolution: number): HexRaw[] {
  const cacheKey = `${techFilter}-r${resolution}`;
  const cached = _runtimeHexes.get(cacheKey);
  if (cached) return cached;
  if (!_erbsForDominance) return [];

  const erbs = techFilter === 'all'
    ? _erbsForDominance
    : _erbsForDominance.filter(e => e.tecnologias?.includes(techFilter));

  const hexMap = new Map<string, Record<string, number>>();
  for (const e of erbs) {
    if (!e.lat || !e.lng) continue;
    const h = latLngToCell(e.lat, e.lng, resolution);
    let counts = hexMap.get(h);
    if (!counts) { counts = {}; hexMap.set(h, counts); }
    counts[e.prestadora_norm] = (counts[e.prestadora_norm] || 0) + 1;
  }

  const hexes: HexRaw[] = [];
  for (const [h3Id, o] of hexMap.entries()) {
    let dominantOp = '', dominantCount = 0, total = 0;
    for (const [op, n] of Object.entries(o)) {
      total += n;
      if (n > dominantCount) { dominantCount = n; dominantOp = op; }
    }
    const pct = total > 0 ? Math.round((dominantCount / total) * 100) : 0;
    hexes.push({ h: h3Id, c: h3ToRing(h3Id), d: dominantOp, p: pct, t: total, o });
  }

  _runtimeHexes.set(cacheKey, hexes);
  return hexes;
}

// Main accessor — hybrid pre-computed (r3-r5) + runtime (r6+)
export function getHexesForZoom(zoom: number, techFilter: 'all' | '5G' | '4G' = 'all'): HexRaw[] {
  const res = getResolutionForZoom(zoom);
  if (res <= 5 && _domData) {
    return _domData[techFilter]?.[`r${res}`] || [];
  }
  return computeRuntimeHexes(techFilter, res);
}

export async function loadDominanceData(): Promise<DominanceData | null> {
  if (_domData) return _domData;
  if (_domLoading) return _domLoading;
  _domLoading = fetch('/assets/dominance.json').then(r => r.json()).then((raw: CompactDominanceData) => {
    const ops = raw.ops;
    const expanded: DominanceData = {
      meta: raw.meta,
      all: {}, '5G': {}, '4G': {},
    };
    for (const tk of ['all', '5G', '4G'] as const) {
      if (!raw[tk]) continue;
      for (const rk of Object.keys(raw[tk])) {
        expanded[tk][rk] = expandHexes(raw[tk][rk], ops);
      }
    }
    _domData = expanded;
    console.log(`[Dominance] Loaded v2 compact data, ${_boundaryCache.size} hex boundaries computed`);
    return expanded;
  }).catch(err => {
    console.error('Failed to load dominance data:', err);
    return null;
  });
  return _domLoading;
}

function getResKey(zoom: number): string {
  return getResKeyForZoom(zoom);
}

export interface DominanceOptions {
  techFilter?: 'all' | '5G' | '4G';
  focusOp?: string | null;  // operator to focus on (green=wins, red=loses)
  rivalOp?: string | null;  // rival to compare against (enables pair mode)
  statusFilter?: DominanceStatus[]; // when set and non-empty, only show hexes matching these statuses
}

export type DominanceStatus = 'wins' | 'contested' | 'absent';

// Compute status of a hex for a given focus operator, optionally vs a rival.
// Solo mode: wins = dominant, contested = present but not dominant, absent = not present
// Pair mode: wins = focus > rival, contested = similar (<20% gap) or both absent, absent = rival > focus
export function computeHexStatus(h: HexRaw, focusOp: string, rivalOp?: string | null): DominanceStatus {
  const myCount = h.o[focusOp] || 0;

  if (rivalOp) {
    const rvCount = h.o[rivalOp] || 0;
    if (myCount === 0 && rvCount === 0) return 'contested';
    const max = Math.max(myCount, rvCount);
    const diff = Math.abs(myCount - rvCount);
    if (max > 0 && diff / max < 0.20) return 'contested';
    return myCount > rvCount ? 'wins' : 'absent';
  }

  if (h.d === focusOp) return 'wins';
  if (myCount > 0) return 'contested';
  return 'absent';
}

export function addDominanceLayer(map: MLMap, opts: DominanceOptions = {}) {
  removeDominanceLayer(map);

  const zoom = map.getZoom();
  const techKey = opts.techFilter || 'all';
  const hexes = getHexesForZoom(zoom, techKey);
  if (!hexes?.length) return;

  const focusOp = opts.focusOp;
  const rivalOp = opts.rivalOp;
  const statusFilter = opts.statusFilter?.length ? new Set(opts.statusFilter) : null;

  const features: GeoJSON.Feature[] = [];
  for (const h of hexes) {
    let color: string;
    let opacity: number;
    let status: DominanceStatus | null = null;

    if (focusOp) {
      status = computeHexStatus(h, focusOp, rivalOp);
      // Apply status filter (only when user has selected specific statuses)
      if (statusFilter && !statusFilter.has(status)) continue;

      if (status === 'wins') {
        color = '#5cb87a'; // green
        const strength = h.t > 0 ? (h.o[focusOp] || 0) / h.t : 0;
        opacity = Math.min(0.2 + strength * 0.5, 0.65);
      } else if (status === 'contested') {
        color = '#e88a4a'; // amber
        const strength = h.t > 0 ? (h.o[focusOp] || 0) / h.t : 0;
        opacity = Math.min(0.12 + strength * 0.3, 0.4);
      } else {
        color = '#e85454'; // red
        opacity = 0.22;
      }
    } else {
      color = OPERADORA_COLORS[h.d] || OPERADORA_COLORS['Outras'];
      opacity = h.p >= 90 ? 0.55 : h.p >= 70 ? 0.35 : h.p >= 50 ? 0.2 : 0.12;
    }

    // Dynamic label based on current mode:
    //   No focus:        "Vivo\n137"          (dominant + total)
    //   Focus solo:      "Vivo\n153"          (focused op + its count)
    //   Pair mode:       "153 vs 98"          (focus count vs rival count — colors already on map)
    let label: string;
    if (focusOp && rivalOp) {
      const my = h.o[focusOp] || 0;
      const rv = h.o[rivalOp] || 0;
      label = `${my} vs ${rv}`;
    } else if (focusOp) {
      const my = h.o[focusOp] || 0;
      label = `${focusOp}\n${my}`;
    } else {
      label = `${h.d}\n${h.t}`;
    }

    features.push({
      type: 'Feature' as const,
      id: h.h, // required for feature-state (hover/active)
      geometry: { type: 'Polygon' as const, coordinates: [h.c] },
      properties: {
        h3: h.h, dominant: h.d, dominantPct: h.p, total: h.t,
        color, opacity, label, status,
        ...h.o,
      },
    });
  }

  const geojson: GeoJSON.FeatureCollection = { type: 'FeatureCollection', features };

  map.addSource(DOM_SOURCE, { type: 'geojson', data: geojson, promoteId: 'h3' });

  map.addLayer({
    id: DOM_FILL, type: 'fill', source: DOM_SOURCE,
    paint: {
      'fill-color': ['get', 'color'],
      // Boost opacity on hover/active via feature-state
      'fill-opacity': [
        'case',
        ['boolean', ['feature-state', 'active'], false],
          ['min', ['*', ['get', 'opacity'], 1.6], 0.85],
        ['boolean', ['feature-state', 'hovered'], false],
          ['min', ['*', ['get', 'opacity'], 1.3], 0.75],
        ['get', 'opacity'],
      ],
    },
  });

  map.addLayer({
    id: DOM_LINE, type: 'line', source: DOM_SOURCE,
    paint: {
      'line-color': ['get', 'color'],
      'line-width': [
        'case',
        ['boolean', ['feature-state', 'active'], false], 2,
        ['boolean', ['feature-state', 'hovered'], false], 1.5,
        0.5,
      ],
      'line-opacity': [
        'case',
        ['boolean', ['feature-state', 'active'], false], 0.95,
        ['boolean', ['feature-state', 'hovered'], false], 0.6,
        0.25,
      ],
    },
  });

  map.addLayer({
    id: DOM_LABEL, type: 'symbol', source: DOM_SOURCE,
    minzoom: 9,
    layout: {
      'text-field': ['get', 'label'],
      'text-size': 10, 'text-font': ['Noto Sans Regular'], 'text-allow-overlap': false,
    },
    paint: { 'text-color': ['get', 'color'], 'text-halo-color': '#0f1419', 'text-halo-width': 1.5 },
  });
}

export function removeDominanceLayer(map: MLMap) {
  [DOM_LABEL, DOM_LINE, DOM_FILL].forEach(id => { if (map.getLayer(id)) map.removeLayer(id); });
  if (map.getSource(DOM_SOURCE)) map.removeSource(DOM_SOURCE);
}

// Debounced zoom update
let _domDebounce: ReturnType<typeof setTimeout> | null = null;
let _lastResKey = '';
let _lastOpts: DominanceOptions = {};

export function updateDominanceForZoom(map: MLMap, opts: DominanceOptions = {}) {
  if (_domDebounce) clearTimeout(_domDebounce);
  _domDebounce = setTimeout(() => {
    const newRes = getResKey(map.getZoom());
    const statusChanged = JSON.stringify(opts.statusFilter || []) !== JSON.stringify(_lastOpts.statusFilter || []);
    const optsChanged =
      opts.focusOp !== _lastOpts.focusOp ||
      opts.techFilter !== _lastOpts.techFilter ||
      opts.rivalOp !== _lastOpts.rivalOp ||
      statusChanged;
    if (newRes === _lastResKey && !optsChanged) return;
    _lastResKey = newRes;
    _lastOpts = { ...opts };
    addDominanceLayer(map, opts);
  }, 200);
}

export function forceRedrawDominance(map: MLMap, opts: DominanceOptions = {}) {
  _lastResKey = '';
  _lastOpts = {};
  addDominanceLayer(map, opts);
}


export interface DominanceStats {
  byOperator: { op: string; count: number; pct: number; hexCount: number }[];
  totalErbs: number;
  totalHexes: number;
}

export function getDominanceStats(techFilter: 'all' | '5G' | '4G' = 'all', resolution = 'r4'): DominanceStats {
  const hexes = getDominanceHexes(techFilter, resolution);
  if (!hexes.length) return { byOperator: [], totalErbs: 0, totalHexes: 0 };

  const opStats: Record<string, { count: number; hexesWon: number }> = {};
  let totalErbs = 0;

  for (const h of hexes) {
    totalErbs += h.t;
    for (const [op, n] of Object.entries(h.o)) {
      if (!opStats[op]) opStats[op] = { count: 0, hexesWon: 0 };
      opStats[op].count += n;
    }
    if (!opStats[h.d]) opStats[h.d] = { count: 0, hexesWon: 0 };
    opStats[h.d].hexesWon++;
  }

  return {
    byOperator: Object.entries(opStats)
      .map(([op, s]) => ({ op, count: s.count, pct: totalErbs > 0 ? s.count / totalErbs : 0, hexCount: s.hexesWon }))
      .sort((a, b) => b.count - a.count),
    totalErbs,
    totalHexes: hexes.length,
  };
}

export function getOperatorFocusStats(op: string, techFilter: 'all' | '5G' | '4G' = 'all', resolution = 'r4') {
  const hexes = getDominanceHexes(techFilter, resolution);
  if (!hexes.length) return null;
  let wins = 0, contested = 0, absent = 0;
  let topRival = '', topRivalGap = 0;

  for (const h of hexes) {
    const myCount = h.o[op] || 0;
    if (h.d === op) wins++;
    else if (myCount > 0) contested++;
    else absent++;

    if (h.d !== op && h.o[h.d]) {
      const gap = (h.o[h.d] || 0) - myCount;
      if (gap > topRivalGap) { topRival = h.d; topRivalGap = gap; }
    }
  }

  const totalRegs = hexes.length;
  return { wins, contested, absent, totalRegs, topRival, topRivalGap, pctDomination: totalRegs > 0 ? Math.round(wins / totalRegs * 100) : 0 };
}

// Raw hex accessor — used by DominancePanel for pair-mode counting to stay
// consistent with the layer's own classification logic.
// Hybrid: pre-computed for r3-r5, runtime-computed for r6+.
export function getDominanceHexes(techFilter: 'all' | '5G' | '4G' = 'all', resolution = 'r4'): HexRaw[] {
  const res = resKeyToNumber(resolution);
  if (res <= 5) {
    if (!_domData) return [];
    return _domData[techFilter]?.[resolution] || [];
  }
  return computeRuntimeHexes(techFilter, res);
}

// Resolution mapping: 'r3' -> 3, 'r4' -> 4, 'r5' -> 5
function resKeyToNumber(resKey: string): number {
  const n = parseInt(resKey.slice(1), 10);
  return isNaN(n) ? 4 : n;
}

// hex -> ERB[] mapping, cached per resolution. Built lazily on first use.
// Iterating 109K ERBs with latLngToCell takes ~150-300ms on first call; cached after.
const _hexToErbsByRes: Record<number, Map<string, number[]>> = {};

// [lng, lat] center of a given H3 cell — GeoJSON-compatible order
export function getHexCenter(h3Id: string): [number, number] {
  const [lat, lng] = cellToLatLng(h3Id);
  return [lng, lat];
}

export function buildHexToErbsMap(erbs: ERB[], resolution: number): Map<string, number[]> {
  if (_hexToErbsByRes[resolution]) return _hexToErbsByRes[resolution];

  const m = new Map<string, number[]>();
  for (const e of erbs) {
    if (!e.lat || !e.lng) continue;
    const h = latLngToCell(e.lat, e.lng, resolution);
    const list = m.get(h);
    if (list) list.push(e.id);
    else m.set(h, [e.id]);
  }
  _hexToErbsByRes[resolution] = m;
  return m;
}

// Collect ERB IDs from hexes that are currently visible given the dominance options.
// Honors techFilter, focusOp, rivalOp, and statusFilter — exactly what the user sees.
// operatorFilter: if provided, only ERBs whose prestadora_norm is in this list are returned.
export function getErbIdsInVisibleHexes(
  erbs: ERB[],
  opts: DominanceOptions,
  resKey: string,
  operatorFilter?: string[]
): number[] {
  const techKey = opts.techFilter || 'all';
  const allHexes = getDominanceHexes(techKey, resKey);
  if (!allHexes.length) return [];

  // Filter hexes by status (same logic as addDominanceLayer)
  const statusFilter = opts.statusFilter?.length ? new Set(opts.statusFilter) : null;
  const visibleHexes = (opts.focusOp && statusFilter)
    ? allHexes.filter(h => statusFilter.has(computeHexStatus(h, opts.focusOp!, opts.rivalOp)))
    : allHexes;

  const resolution = resKeyToNumber(resKey);
  const hexMap = buildHexToErbsMap(erbs, resolution);

  const ids = new Set<number>();
  for (const h of visibleHexes) {
    const list = hexMap.get(h.h);
    if (list) for (const id of list) ids.add(id);
  }

  // Apply ERB-level filters: tech and operator
  const needsTechFilter = opts.techFilter && opts.techFilter !== 'all';
  const needsOpFilter = operatorFilter && operatorFilter.length > 0;
  if (!needsTechFilter && !needsOpFilter) return Array.from(ids);

  const opSet = needsOpFilter ? new Set(operatorFilter) : null;
  const erbById = new Map(erbs.map(e => [e.id, e]));
  const filtered: number[] = [];
  for (const id of ids) {
    const e = erbById.get(id);
    if (!e) continue;
    if (needsTechFilter && !e.tecnologias.includes(opts.techFilter!)) continue;
    if (opSet && !opSet.has(e.prestadora_norm)) continue;
    filtered.push(id);
  }
  return filtered;
}
