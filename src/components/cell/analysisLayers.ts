import type { Map as MLMap } from 'maplibre-gl';
import { OPERADORA_COLORS } from '../../lib/constants';
import type { ERB } from './cellData';

// ─── Heatmap Layer ───────────────────────────────

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
      'heatmap-weight': ['interpolate', ['linear'], ['zoom'], 0, 0.3, 9, 1],
      'heatmap-intensity': ['interpolate', ['linear'], ['zoom'], 0, 0.5, 9, 2],
      'heatmap-color': [
        'interpolate', ['linear'], ['heatmap-density'],
        0, 'rgba(0,0,0,0)', 0.1, 'rgba(33,102,172,0.4)', 0.3, 'rgba(51,151,185,0.6)',
        0.5, 'rgba(102,194,165,0.7)', 0.7, 'rgba(237,217,0,0.8)', 0.9, 'rgba(245,39,43,0.85)', 1, 'rgba(180,4,38,0.9)',
      ],
      'heatmap-radius': ['interpolate', ['linear'], ['zoom'], 0, 8, 4, 15, 7, 25, 10, 40, 14, 60],
      'heatmap-opacity': ['interpolate', ['linear'], ['zoom'], 12, 0.8, 15, 0.3],
    },
  });
}

export function removeHeatmapLayer(map: MLMap) {
  if (map.getLayer(HEATMAP_LAYER)) map.removeLayer(HEATMAP_LAYER);
  if (map.getSource(HEATMAP_SOURCE)) map.removeSource(HEATMAP_SOURCE);
}

// ─── Dominance Layer (pre-computed H3) ───────────

const DOM_SOURCE = 'erb-dominance';
const DOM_FILL = 'erb-dominance-fill';
const DOM_LINE = 'erb-dominance-line';
const DOM_LABEL = 'erb-dominance-label';

interface HexRaw {
  h: string;           // h3 index
  c: number[][];       // coordinates ring
  d: string;           // dominant operator
  p: number;           // dominant pct (0-100)
  t: number;           // total ERBs
  o: Record<string, number>; // per-operator counts
}

interface DominanceData {
  meta: { generated: string; source: string; totalErbs: number; resolutions: number[] };
  all: Record<string, HexRaw[]>;
  '5G': Record<string, HexRaw[]>;
  '4G': Record<string, HexRaw[]>;
}

let _domData: DominanceData | null = null;
let _domLoading: Promise<DominanceData | null> | null = null;

export async function loadDominanceData(): Promise<DominanceData | null> {
  if (_domData) return _domData;
  if (_domLoading) return _domLoading;
  _domLoading = fetch('/assets/dominance.json').then(r => r.json()).then(d => {
    _domData = d;
    return d;
  }).catch(err => {
    console.error('Failed to load dominance data:', err);
    return null;
  });
  return _domLoading;
}

function getResKey(zoom: number): string {
  if (zoom < 6) return 'r3';
  if (zoom < 8) return 'r4';
  return 'r5';
}

export interface DominanceOptions {
  techFilter?: 'all' | '5G' | '4G';
  focusOp?: string | null;  // operator to focus on (green=wins, red=loses)
}

export function addDominanceLayer(map: MLMap, opts: DominanceOptions = {}) {
  removeDominanceLayer(map);
  if (!_domData) return;

  const zoom = map.getZoom();
  const resKey = getResKey(zoom);
  const techKey = opts.techFilter || 'all';
  const hexes = _domData[techKey]?.[resKey];
  if (!hexes?.length) return;

  const focusOp = opts.focusOp;

  const geojson: GeoJSON.FeatureCollection = {
    type: 'FeatureCollection',
    features: hexes.map(h => {
      let color: string;
      let opacity: number;

      if (focusOp) {
        const myCount = h.o[focusOp] || 0;
        const isDominant = h.d === focusOp;
        const strength = h.t > 0 ? myCount / h.t : 0;

        if (isDominant) {
          color = '#5cb87a'; // green — this operator dominates here
          opacity = Math.min(0.2 + strength * 0.5, 0.65);
        } else if (myCount > 0) {
          color = '#e88a4a'; // amber — present but not dominant
          opacity = Math.min(0.1 + strength * 0.3, 0.35);
        } else {
          color = '#e85454'; // red — not present at all
          opacity = 0.2;
        }
      } else {
        // General mode: color by dominant operator
        color = OPERADORA_COLORS[h.d] || OPERADORA_COLORS['Outras'];
        opacity = h.p >= 90 ? 0.55 : h.p >= 70 ? 0.35 : h.p >= 50 ? 0.2 : 0.12;
      }

      return {
        type: 'Feature' as const,
        geometry: { type: 'Polygon' as const, coordinates: [h.c] },
        properties: {
          dominant: h.d, dominantPct: h.p, total: h.t,
          color, opacity, ...h.o,
        },
      };
    }),
  };

  map.addSource(DOM_SOURCE, { type: 'geojson', data: geojson });

  map.addLayer({
    id: DOM_FILL, type: 'fill', source: DOM_SOURCE,
    paint: {
      'fill-color': ['get', 'color'],
      'fill-opacity': ['get', 'opacity'],
    },
  });

  map.addLayer({
    id: DOM_LINE, type: 'line', source: DOM_SOURCE,
    paint: { 'line-color': ['get', 'color'], 'line-width': 0.5, 'line-opacity': 0.25 },
  });

  map.addLayer({
    id: DOM_LABEL, type: 'symbol', source: DOM_SOURCE,
    minzoom: 9,
    layout: {
      'text-field': ['concat', ['get', 'dominant'], '\n', ['to-string', ['get', 'total']]],
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
    const optsChanged = opts.focusOp !== _lastOpts.focusOp || opts.techFilter !== _lastOpts.techFilter;
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

// ─── Stats ──────────────────────────────────────

export interface DominanceStats {
  byOperator: { op: string; count: number; pct: number; hexCount: number }[];
  totalErbs: number;
  totalHexes: number;
}

export function getDominanceStats(techFilter: 'all' | '5G' | '4G' = 'all', resolution = 'r4'): DominanceStats {
  if (!_domData) return { byOperator: [], totalErbs: 0, totalHexes: 0 };

  const hexes = _domData[techFilter]?.[resolution] || [];
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
  if (!_domData) return null;
  const hexes = _domData[techFilter]?.[resolution] || [];
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
