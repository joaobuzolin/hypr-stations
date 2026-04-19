import { useState, useCallback, useRef, useMemo, useEffect } from 'react';
import maplibregl from 'maplibre-gl';
import type { Map as MLMap, GeoJSONSource } from 'maplibre-gl';
import MapContainer from '../shared/MapContainer';
import SelectionBar from '../shared/SelectionBar';
import CheckoutModal from '../shared/CheckoutModal';
import { useAuth } from '../shared/AuthProvider';
import CellFilters from './CellFilters';
import CellStationList from './CellStationList';
import MobileDrawer from '../shared/MobileDrawer';
import ViewModeSelector from './ViewModeSelector';
import DominancePanel from './DominancePanel';
import CellLegend from './CellLegend';
import { fetchERBs, getFilterOptions, type ERB } from './cellData';
import { OPERADORA_COLORS, TECH_COLORS } from '../../lib/constants';
import { formatAudience, estimateCellAudience, estimateCellRadius } from '../../lib/audience';
import { addHeatmapLayer, removeHeatmapLayer, addDominanceLayer, removeDominanceLayer, updateDominanceForZoom, forceRedrawDominance, loadDominanceData, setErbsForDominance, getErbIdsInVisibleHexes, buildHexToErbsMap, getHexCenter, getResolutionForZoom, type DominanceOptions } from './analysisLayers';
import { updateCoverageCircles, removeCoverageCircles } from './coverageLayer';
import { downloadCSV } from '../../lib/csv';

const CELL_CSV_HEADERS = ['prestadora_norm', 'uf', 'municipio', 'lat', 'lng', 'tech_principal', 'tecnologias'];

function exportCellCSV(erbs: ERB[], cart: Set<number>) {
  const sel = erbs.filter(e => cart.has(e.id));
  if (!sel.length) return;
  const rows = sel.map(e => ({
    ...e,
    tecnologias: e.tecnologias.join(';'),
  }));
  downloadCSV(CELL_CSV_HEADERS, rows as unknown as Record<string, unknown>[], 'HYPR_CellMap_' + new Date().toISOString().slice(0, 10) + '.csv');
}


export default function CellMap() {
  const { isHypr, login } = useAuth();
  const [allErbs, setAllErbs] = useState<ERB[]>([]);
  const [filtered, setFiltered] = useState<ERB[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadProgress, setLoadProgress] = useState(0);
  const [cart, setCart] = useState<Set<number>>(new Set());
  const cartRef = useRef<Set<number>>(cart);
  cartRef.current = cart;
  const [activeIdx, setActiveIdx] = useState<number | null>(null);
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [viewMode, setViewMode] = useState<string>('pins');
  const [showCoverage, setShowCoverage] = useState(false);
  const mapRef = useRef<MLMap | null>(null);
  const popupRef = useRef<maplibregl.Popup | null>(null);
  const activeHexRef = useRef<string | null>(null);
  const hoveredHexRef = useRef<string | null>(null);
  const openHexPopupRef = useRef<((feat: maplibregl.MapGeoJSONFeature, lngLat: maplibregl.LngLat) => void) | null>(null);
  const viewModeRef = useRef<string>('pins');
  const coverageRef = useRef(false);
  const filteredRef = useRef<ERB[]>([]);
  filteredRef.current = filtered;
  const domOptsRef = useRef<DominanceOptions>({});
  const [domOpts, setDomOpts] = useState<DominanceOptions>({});
  const [mapZoom, setMapZoom] = useState(4.2);

  // Load data
  useEffect(() => {
    // Load ERBs and dominance data in parallel
    Promise.all([
      fetchERBs((n) => setLoadProgress(n)),
      loadDominanceData(),
    ]).then(([data]) => {
      setAllErbs(data);
      setFiltered(data);
      // Inject ERB reference so analysisLayers can compute hex grids at r6/r7
      // on demand (pre-computed dominance.json only covers r3-r5).
      setErbsForDominance(data);
      setLoading(false);
    }).catch(err => {
      console.error('Failed to load data:', err);
      setLoading(false);
    });
  }, []);

  const filterOptions = useMemo(() => getFilterOptions(allErbs), [allErbs]);


  const clearLayers = useCallback(() => {
    const map = mapRef.current;
    if (!map) return;
    ['cell-clusters', 'cell-cluster-count', 'cell-points'].forEach(id => {
      if (map.getLayer(id)) map.removeLayer(id);
    });
    if (map.getSource('cell-erb')) map.removeSource('cell-erb');
  }, []);

  const syncLayers = useCallback(() => {
    const map = mapRef.current;
    const data = filteredRef.current;
    const mode = viewModeRef.current;
    if (!map || !map.isStyleLoaded()) return;

    // Clear everything
    clearLayers();
    removeHeatmapLayer(map);
    removeDominanceLayer(map);
    removeCoverageCircles(map);

    if (!data.length) return;

    if (mode === 'heatmap') {
      addHeatmapLayer(map, data);
      return;
    }
    if (mode === 'dominance') {
      addDominanceLayer(map, domOptsRef.current);
      return;
    }

    // Pins mode
    const geojson: GeoJSON.FeatureCollection = {
      type: 'FeatureCollection',
      features: data.filter(e => e.lat && e.lng).map((e, i) => ({
        type: 'Feature' as const,
        geometry: { type: 'Point' as const, coordinates: [e.lng, e.lat] },
        properties: { idx: i, id: e.id, op: e.prestadora_norm, tech: e.tech_principal },
      })),
    };

    map.addSource('cell-erb', {
      type: 'geojson',
      data: geojson,
      cluster: true,
      clusterMaxZoom: 14,
      clusterRadius: 60,
      clusterProperties: {
        vivo: ['+', ['case', ['==', ['get', 'op'], 'Vivo'], 1, 0]],
        claro: ['+', ['case', ['==', ['get', 'op'], 'Claro'], 1, 0]],
        tim: ['+', ['case', ['==', ['get', 'op'], 'TIM'], 1, 0]],
        brisanet: ['+', ['case', ['==', ['get', 'op'], 'Brisanet'], 1, 0]],
        algar: ['+', ['case', ['==', ['get', 'op'], 'Algar'], 1, 0]],
        unifique: ['+', ['case', ['==', ['get', 'op'], 'Unifique'], 1, 0]],
      },
    });

    const opColorExpr = (prop: string): any => [
      'match', ['get', prop],
      'Vivo', OPERADORA_COLORS.Vivo,
      'Claro', OPERADORA_COLORS.Claro,
      'TIM', OPERADORA_COLORS.TIM,
      'Algar', OPERADORA_COLORS.Algar,
      'Brisanet', OPERADORA_COLORS.Brisanet,
      'Unifique', OPERADORA_COLORS.Unifique,
      'Sercomtel', OPERADORA_COLORS.Sercomtel,
      OPERADORA_COLORS.Outras,
    ];

    const clusterColorExpr: any = (() => {
      const ops = ['vivo', 'claro', 'tim', 'brisanet', 'algar', 'unifique'] as const;
      const colors: Record<string, string> = {
        vivo: OPERADORA_COLORS.Vivo, claro: OPERADORA_COLORS.Claro,
        tim: OPERADORA_COLORS.TIM, brisanet: OPERADORA_COLORS.Brisanet,
        algar: OPERADORA_COLORS.Algar, unifique: OPERADORA_COLORS.Unifique,
      };
      const expr: any[] = ['case'];
      for (const op of ops) {
        const conds = ops.filter(o => o !== op).map(o => ['>=', ['get', op], ['get', o]]);
        expr.push(['all', ...conds], colors[op]);
      }
      expr.push(OPERADORA_COLORS.Outras);
      return expr;
    })();

    map.addLayer({
      id: 'cell-clusters', type: 'circle', source: 'cell-erb',
      filter: ['has', 'point_count'],
      paint: {
        'circle-color': clusterColorExpr, 'circle-opacity': 0.25,
        'circle-radius': ['step', ['get', 'point_count'], 16, 50, 20, 200, 26, 1000, 34, 5000, 42],
        'circle-stroke-width': 1.5, 'circle-stroke-color': clusterColorExpr, 'circle-stroke-opacity': 0.6,
      },
    });

    map.addLayer({
      id: 'cell-cluster-count', type: 'symbol', source: 'cell-erb',
      filter: ['has', 'point_count'],
      layout: { 'text-field': '{point_count_abbreviated}', 'text-font': ['Noto Sans Regular'], 'text-size': 12 },
      paint: { 'text-color': clusterColorExpr },
    });

    map.addLayer({
      id: 'cell-points', type: 'circle', source: 'cell-erb',
      filter: ['!', ['has', 'point_count']],
      paint: {
        'circle-radius': 5, 'circle-color': opColorExpr('op'), 'circle-opacity': 0.85,
        'circle-stroke-width': 1, 'circle-stroke-color': opColorExpr('op'), 'circle-stroke-opacity': 0.5,
      },
    });

    if (coverageRef.current) updateCoverageCircles(map, data, true);
  }, [clearLayers]);


  const handleViewModeChange = useCallback((mode: string) => {
    viewModeRef.current = mode;
    setViewMode(mode);
    if (mode !== 'dominance') {
      domOptsRef.current = {};
      setDomOpts({});
    }
    syncLayers();
  }, [syncLayers]);

  const handleDomOptsChange = useCallback((opts: DominanceOptions) => {
    domOptsRef.current = opts;
    setDomOpts(opts);
    const map = mapRef.current;
    if (map && viewModeRef.current === 'dominance') {
      // Close any open hex popup — the data (and hex visibility) is about to change
      if (popupRef.current) popupRef.current.remove();
      activeHexRef.current = null;
      hoveredHexRef.current = null;
      forceRedrawDominance(map, opts);
    }
  }, []);

  // Collect ERB IDs from dominance hexes currently visible (honors all filters)
  // and merge them into the cart. Returns count of newly added IDs.
  const handleAddVisibleToCart = useCallback(async (
    opts: DominanceOptions,
    resKey: string,
    options: { includeAllOperators: boolean } = { includeAllOperators: false }
  ): Promise<number> => {
    if (!allErbs.length) return 0;
    await new Promise(r => setTimeout(r, 0));
    // Default: only ERBs of the focus operator. Checkbox opts into all operators.
    const operatorFilter = options.includeAllOperators || !opts.focusOp
      ? undefined
      : [opts.focusOp];
    const ids = getErbIdsInVisibleHexes(allErbs, opts, resKey, operatorFilter);
    let addedCount = 0;
    setCart(prev => {
      const n = new Set(prev);
      for (const id of ids) {
        if (!n.has(id)) { n.add(id); addedCount++; }
      }
      return n;
    });
    return addedCount;
  }, [allErbs]);

  // Preview count — used by DominancePanel to show the number on the button label
  // before the user clicks. Same filtering logic as handleAddVisibleToCart.
  const handleGetVisibleErbCount = useCallback((
    opts: DominanceOptions,
    resKey: string,
    options: { includeAllOperators: boolean } = { includeAllOperators: false }
  ): number => {
    if (!allErbs.length) return 0;
    const operatorFilter = options.includeAllOperators || !opts.focusOp
      ? undefined
      : [opts.focusOp];
    return getErbIdsInVisibleHexes(allErbs, opts, resKey, operatorFilter).length;
  }, [allErbs]);

  const toggleCoverage = useCallback(() => {
    const next = !coverageRef.current;
    coverageRef.current = next;
    setShowCoverage(next);
    const map = mapRef.current;
    if (map && viewModeRef.current === 'pins') {
      updateCoverageCircles(map, filteredRef.current, next);
    }
  }, []);

  // Re-render when filtered data changes
  useEffect(() => {
    if (filtered.length > 0 && mapRef.current) {
      syncLayers();
    }
  }, [filtered, syncLayers]);


  const onMapReady = useCallback((map: MLMap) => {
    mapRef.current = map;

    // Click handlers (registered once per map instance)
    map.on('click', 'cell-clusters', (e) => {
      const feat = map.queryRenderedFeatures(e.point, { layers: ['cell-clusters'] });
      if (!feat.length) return;
      const src = map.getSource('cell-erb') as GeoJSONSource;
      if (!src) return;
      src.getClusterExpansionZoom(feat[0].properties?.cluster_id).then(z => {
        map.easeTo({ center: (feat[0].geometry as GeoJSON.Point).coordinates as [number, number], zoom: z });
      });
    });

    map.on('click', 'cell-points', (e) => {
      if (!e.features?.length) return;
      const idx = e.features[0].properties?.idx;
      if (idx != null) {
        setActiveIdx(idx);
        const coords = (e.features[0].geometry as GeoJSON.Point).coordinates as [number, number];
        openPopup(idx, coords);
      }
    });

    ['cell-clusters', 'cell-points'].forEach(id => {
      map.on('mouseenter', id, () => { map.getCanvas().style.cursor = 'pointer'; });
      map.on('mouseleave', id, () => { map.getCanvas().style.cursor = ''; });
    });

    // Dominance hex interactions — hover, active, click-to-popup
    const DOM_FILL = 'erb-dominance-fill';
    const DOM_SRC = 'erb-dominance';

    map.on('mousemove', DOM_FILL, (e) => {
      if (!e.features?.length) return;
      const id = e.features[0].id as string | undefined;
      if (!id) return;
      map.getCanvas().style.cursor = 'pointer';
      if (hoveredHexRef.current === id) return;
      if (hoveredHexRef.current) {
        try { map.setFeatureState({ source: DOM_SRC, id: hoveredHexRef.current }, { hovered: false }); } catch {}
      }
      hoveredHexRef.current = id;
      try { map.setFeatureState({ source: DOM_SRC, id }, { hovered: true }); } catch {}
    });

    map.on('mouseleave', DOM_FILL, () => {
      map.getCanvas().style.cursor = '';
      if (hoveredHexRef.current) {
        try { map.setFeatureState({ source: DOM_SRC, id: hoveredHexRef.current }, { hovered: false }); } catch {}
        hoveredHexRef.current = null;
      }
    });

    map.on('click', DOM_FILL, (e) => {
      if (!e.features?.length) return;
      const feat = e.features[0];
      const id = feat.id as string | undefined;
      if (!id) return;

      // Clear previous active state
      if (activeHexRef.current && activeHexRef.current !== id) {
        try { map.setFeatureState({ source: DOM_SRC, id: activeHexRef.current }, { active: false }); } catch {}
      }
      activeHexRef.current = id;
      try { map.setFeatureState({ source: DOM_SRC, id }, { active: true }); } catch {}

      openHexPopupRef.current?.(feat, e.lngLat);
    });

    map.on('zoomend', () => {
      const mode = viewModeRef.current;
      setMapZoom(map.getZoom());
      if (mode === 'pins' && coverageRef.current) {
        updateCoverageCircles(map, filteredRef.current, true);
      } else if (mode === 'dominance') {
        updateDominanceForZoom(map, domOptsRef.current);
      }
    });

    // Render layers now
    syncLayers();
  }, [syncLayers]);

  const toggleCart = useCallback((id: number) => {
    setCart(p => { const n = new Set(p); n.has(id) ? n.delete(id) : n.add(id); return n; });
  }, []);

  const openPopup = useCallback((idx: number, coords: [number, number]) => {
    const e = filteredRef.current[idx];
    if (!e || !mapRef.current) return;
    if (popupRef.current) popupRef.current.remove();

    const opColor = OPERADORA_COLORS[e.prestadora_norm] || '#7a6e64';
    const radius = estimateCellRadius(e.tech_principal, e.freq_mhz?.[0] ?? 0);
    const aud = estimateCellAudience(e.tech_principal, e.uf, e.freq_mhz?.[0] ?? 0);

    const isDark = !document.documentElement.classList.contains('light');
    const c = {
      textPrimary: isDark ? '#e8ecf0' : '#1a2530',
      textSecondary: isDark ? '#8899a6' : '#576773',
      textFaint: isDark ? '#3d4d58' : '#c5cdd6',
      textMuted: isDark ? '#576773' : '#8899a6',
      border: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)',
      mono: isDark ? '#8899a6' : '#576773',
      audBg: isDark ? 'rgba(77,184,212,0.08)' : 'rgba(42,127,158,0.06)',
      audBorder: isDark ? 'rgba(77,184,212,0.2)' : 'rgba(42,127,158,0.12)',
      accent: isDark ? '#4db8d4' : '#2a7f9e',
      footerOpacity: '0.4',
    };

    const techBadges = e.tecnologias.map(t => {
      const tc = TECH_COLORS[t] || '#576773';
      return `<span style="display:inline-flex;align-items:center;padding:2px 8px;border-radius:5px;font-size:10px;font-weight:600;letter-spacing:0.03em;background:${tc}15;color:${tc};border:0.5px solid ${tc}25">${t}</span>`;
    }).join(' ');

    const html = `<div style="font-family:Urbanist,system-ui,sans-serif">
      <div style="padding:20px 22px 16px">
        <div style="display:flex;align-items:center;gap:10px;margin-bottom:6px">
          <div style="width:8px;height:8px;border-radius:50%;background:${opColor};flex-shrink:0"></div>
          <span style="font-weight:700;font-size:16px;color:${opColor};letter-spacing:-0.01em">${e.prestadora_norm}</span>
          <span style="font-size:10px;color:${c.textFaint};margin-left:auto;font-family:monospace;letter-spacing:0.02em">${e.num_estacao}</span>
        </div>
        <div style="font-size:13px;font-weight:500;color:${c.textPrimary};margin-bottom:12px;margin-left:18px">${e.municipio} — ${e.uf}</div>
        <div style="display:flex;gap:5px;flex-wrap:wrap;margin-left:18px">${techBadges}</div>
      </div>
      <div style="height:0.5px;background:${c.border};margin:0 22px"></div>
      <div style="display:flex;padding:14px 22px;gap:24px">
        <div>
          <div style="font-size:10px;letter-spacing:0.04em;text-transform:uppercase;color:${c.textFaint};margin-bottom:4px">Alcance</div>
          <div style="font-size:14px;font-weight:600;color:${c.textPrimary}">~${Math.round(radius)} km</div>
        </div>
        <div>
          <div style="font-size:10px;letter-spacing:0.04em;text-transform:uppercase;color:${c.textFaint};margin-bottom:4px">Coordenadas</div>
          <div style="font-size:12px;font-weight:500;color:${c.mono};font-family:monospace">${e.lat.toFixed(4)}, ${e.lng.toFixed(4)}</div>
        </div>
      </div>
      ${aud > 0 ? `
      <div style="margin:0 14px 14px;padding:14px 16px;background:${c.audBg};border:0.5px solid ${c.audBorder};border-radius:10px;text-align:center">
        <div style="font-size:10px;letter-spacing:0.04em;text-transform:uppercase;color:${c.textMuted};margin-bottom:4px">População no raio</div>
        <div style="font-weight:700;font-size:18px;color:${c.accent};letter-spacing:-0.01em">${formatAudience(aud)} devices</div>
      </div>` : ''}
      <div style="font-size:10px;color:${c.textFaint};text-align:center;padding:0 22px 4px;opacity:${c.footerOpacity}">Anatel Fev/2026 · Modelo HYPR</div>
      <div style="padding:0 14px 14px">
        <button data-cart-id="${e.id}" style="width:100%;padding:10px;border-radius:10px;font-size:12px;font-weight:600;font-family:Urbanist,sans-serif;cursor:pointer;transition:all 0.15s;border:0.5px solid ${cartRef.current.has(e.id) ? 'var(--color-red-400)' : c.accent};background:${cartRef.current.has(e.id) ? 'transparent' : c.accent};color:${cartRef.current.has(e.id) ? 'var(--color-red-400)' : 'var(--on-accent)'}">${cartRef.current.has(e.id) ? 'Remover do plano' : 'Adicionar ao plano'}</button>
      </div>
    </div>`;

    const popup = new maplibregl.Popup({ closeButton: true, closeOnClick: true, maxWidth: '360px', offset: 10 })
      .setLngLat(coords).setHTML(html).addTo(mapRef.current!);
    const el = popup.getElement();
    el?.querySelector('[data-cart-id]')?.addEventListener('click', () => {
      toggleCart(e.id);
      popup.remove();
    });
    popupRef.current = popup;
    popup.on('close', () => { popupRef.current = null; });

    drawCoverageCircle(e, coords, radius);
  }, []);


  const drawCoverageCircle = useCallback((e: ERB, center: [number, number], radiusKm: number) => {
    const map = mapRef.current;
    if (!map) return;

    const sourceId = 'coverage-circle';
    const layerId = 'coverage-circle-fill';
    const borderLayerId = 'coverage-circle-border';

    if (map.getLayer(layerId)) map.removeLayer(layerId);
    if (map.getLayer(borderLayerId)) map.removeLayer(borderLayerId);
    if (map.getSource(sourceId)) map.removeSource(sourceId);

    const steps = 64;
    const coords: number[][] = [];
    for (let i = 0; i <= steps; i++) {
      const angle = (i / steps) * 2 * Math.PI;
      const dx = radiusKm * Math.cos(angle);
      const dy = radiusKm * Math.sin(angle);
      const lat = center[1] + (dy / 111.32);
      const lng = center[0] + (dx / (111.32 * Math.cos(center[1] * Math.PI / 180)));
      coords.push([lng, lat]);
    }

    const color = OPERADORA_COLORS[e.prestadora_norm] || '#4db8d4';

    map.addSource(sourceId, {
      type: 'geojson',
      data: { type: 'Feature', geometry: { type: 'Polygon', coordinates: [coords] }, properties: {} },
    });
    map.addLayer({ id: layerId, type: 'fill', source: sourceId, paint: { 'fill-color': color, 'fill-opacity': 0.08 } });
    map.addLayer({ id: borderLayerId, type: 'line', source: sourceId, paint: { 'line-color': color, 'line-width': 1.5, 'line-opacity': 0.4, 'line-dasharray': [4, 4] } });

    if (popupRef.current) {
      popupRef.current.on('close', () => {
        if (map.getLayer(layerId)) map.removeLayer(layerId);
        if (map.getLayer(borderLayerId)) map.removeLayer(borderLayerId);
        if (map.getSource(sourceId)) map.removeSource(sourceId);
      });
    }
  }, []);


  // Add ERBs from a single hex to cart (honors focus/tech filters). Returns added count.
  const handleAddHexToCart = useCallback((h3Id: string): number => {
    if (!allErbs.length) return 0;
    const opts = domOptsRef.current;
    const map = mapRef.current;
    const resolution = map ? getResolutionForZoom(map.getZoom()) : 4;
    const hexMap = buildHexToErbsMap(allErbs, resolution);
    const erbIds = hexMap.get(h3Id) || [];
    if (!erbIds.length) return 0;

    const erbById = new Map(allErbs.map(e => [e.id, e]));
    const techFilter = opts.techFilter && opts.techFilter !== 'all' ? opts.techFilter : null;
    const opFilter = opts.focusOp; // cart default: only focus operator

    let added = 0;
    setCart(prev => {
      const n = new Set(prev);
      for (const id of erbIds) {
        const e = erbById.get(id);
        if (!e) continue;
        if (opFilter && e.prestadora_norm !== opFilter) continue;
        if (techFilter && !e.tecnologias.includes(techFilter)) continue;
        if (!n.has(id)) { n.add(id); added++; }
      }
      return n;
    });
    return added;
  }, [allErbs]);


  // Drill-down to a deeper resolution. Centers map on the hex and zooms in.
  const handleDrillZoom = useCallback((h3Id: string) => {
    const map = mapRef.current;
    if (!map) return;
    const [lng, lat] = getHexCenter(h3Id);
    const z = map.getZoom();
    const targetZoom = z < 6 ? 7.2 : z < 8 ? 9.2 : Math.min(z + 2, 12);
    map.flyTo({ center: [lng, lat], zoom: targetZoom, speed: 1.2 });
    if (popupRef.current) popupRef.current.remove();
  }, []);


  // Open popup with hex breakdown — operator shares, status, action buttons
  const openHexPopup = useCallback((feat: maplibregl.MapGeoJSONFeature, lngLat: maplibregl.LngLat) => {
    const map = mapRef.current;
    if (!map) return;
    if (popupRef.current) popupRef.current.remove();

    const props = feat.properties || {};
    const h3Id = props.h3 as string;
    const dominant = props.dominant as string;
    const total = props.total as number;
    const dominantPct = props.dominantPct as number;
    const status = (props.status as string | null) || null;

    // Extract operator counts from properties (stored by addDominanceLayer via spread of h.o)
    const opCounts: [string, number][] = [];
    for (const [k, v] of Object.entries(props)) {
      if (typeof v === 'number' && OPERADORA_COLORS[k]) {
        opCounts.push([k, v as number]);
      }
    }
    opCounts.sort((a, b) => b[1] - a[1]);

    const opts = domOptsRef.current;
    const focusOp = opts.focusOp;
    const rivalOp = opts.rivalOp;
    const inPairMode = !!(focusOp && rivalOp);

    const statusConfig: Record<string, { color: string; bg: string; label: string; labelPair: string }> = {
      wins:      { color: '#5cb87a', bg: 'rgba(92,184,122,0.12)',  label: 'Domina',  labelPair: 'Vence' },
      contested: { color: '#e88a4a', bg: 'rgba(232,138,74,0.12)',  label: 'Disputa', labelPair: 'Empate' },
      absent:    { color: '#e85454', bg: 'rgba(232,84,84,0.12)',   label: 'Ausente', labelPair: 'Perde' },
    };
    const statusBadge = (status && statusConfig[status]) ? (() => {
      const cfg = statusConfig[status];
      const label = inPairMode ? cfg.labelPair : cfg.label;
      return `<span style="display:inline-flex;align-items:center;padding:2px 8px;border-radius:4px;font-size:10px;font-weight:700;letter-spacing:0.04em;text-transform:uppercase;background:${cfg.bg};color:${cfg.color}">${label}</span>`;
    })() : '';

    // Pair-mode head line: "Vivo 153 vs TIM 98"
    const pairLine = inPairMode ? (() => {
      const my = props[focusOp!] as number || 0;
      const rv = props[rivalOp!] as number || 0;
      const focusColor = OPERADORA_COLORS[focusOp!] || '#7a6e64';
      const rivalColor = OPERADORA_COLORS[rivalOp!] || '#7a6e64';
      return `<div style="display:flex;align-items:center;gap:8px;margin-bottom:10px;padding:10px 12px;background:var(--bg-surface2);border-radius:8px;font-size:12px">
        <span style="color:${focusColor};font-weight:700">${focusOp}</span>
        <strong style="color:var(--text-primary);font-variant-numeric:tabular-nums">${my}</strong>
        <span style="color:var(--text-faint)">vs</span>
        <span style="color:${rivalColor};font-weight:700">${rivalOp}</span>
        <strong style="color:var(--text-primary);font-variant-numeric:tabular-nums">${rv}</strong>
      </div>`;
    })() : '';

    // Proportional operator list (top 6)
    const opRows = opCounts.slice(0, 6).map(([op, n]) => {
      const pct = total > 0 ? Math.round((n / total) * 100) : 0;
      const color = OPERADORA_COLORS[op] || OPERADORA_COLORS['Outras'];
      const isFocus = op === focusOp;
      const isRival = op === rivalOp;
      const labelStyle = isFocus ? `font-weight:700;color:${color}` : isRival ? `font-weight:600;color:${color}` : 'color:var(--text-primary)';
      return `<div style="display:flex;align-items:center;gap:10px;font-size:12px;margin-bottom:6px">
        <span style="display:inline-block;width:6px;height:6px;border-radius:50%;background:${color};flex-shrink:0"></span>
        <span style="${labelStyle};min-width:66px">${op}</span>
        <div style="flex:1;height:4px;border-radius:2px;background:var(--input-bg);overflow:hidden">
          <div style="height:100%;width:${pct}%;background:${color}"></div>
        </div>
        <span style="color:var(--text-muted);font-variant-numeric:tabular-nums;min-width:58px;text-align:right">
          <strong style="color:var(--text-primary);font-weight:600">${n}</strong> · ${pct}%
        </span>
      </div>`;
    }).join('');

    // Drill-down button only shown below max resolution (r5 = zoom 8+)
    const z = map.getZoom();
    const showDrill = z < 8;

    const html = `<div style="font-family:Urbanist,system-ui,sans-serif;min-width:280px">
      <div style="padding:16px 18px 12px">
        <div style="display:flex;align-items:center;gap:8px;margin-bottom:6px">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <polygon points="21 16 21 8 12 3 3 8 3 16 12 21 21 16"/>
          </svg>
          <span style="font-size:10px;letter-spacing:0.04em;text-transform:uppercase;color:var(--text-muted);font-weight:600">Região</span>
          ${statusBadge ? `<span style="margin-left:auto">${statusBadge}</span>` : ''}
        </div>
        <div style="font-size:13px;color:var(--text-primary);margin-bottom:12px">
          <strong style="font-weight:600">${total.toLocaleString('pt-BR')}</strong>
          <span style="color:var(--text-muted)"> ERBs · ${dominant} lidera com ${dominantPct}%</span>
        </div>
        ${pairLine}
        ${opRows}
      </div>
      <div style="padding:10px 12px;border-top:0.5px solid var(--border);display:flex;gap:6px">
        ${showDrill ? `<button data-action="drill" style="flex:0 0 auto;padding:8px 12px;border-radius:8px;font-size:11px;font-weight:600;font-family:Urbanist,sans-serif;cursor:pointer;background:transparent;color:var(--text-secondary);border:0.5px solid var(--input-border);transition:all 0.15s">Aproximar</button>` : ''}
        <button data-action="add-region" style="flex:1;padding:8px;border-radius:8px;font-size:11px;font-weight:700;font-family:Urbanist,sans-serif;cursor:pointer;background:var(--accent);color:var(--on-accent);border:0;transition:all 0.15s">Adicionar esta região</button>
      </div>
    </div>`;

    const popup = new maplibregl.Popup({
      closeButton: true,
      closeOnClick: true,
      maxWidth: '320px',
      offset: 8,
    }).setLngLat(lngLat).setHTML(html).addTo(map);

    const el = popup.getElement();

    el?.querySelector('[data-action="add-region"]')?.addEventListener('click', (ev) => {
      const btn = ev.currentTarget as HTMLButtonElement;
      const added = handleAddHexToCart(h3Id);
      btn.textContent = added > 0 ? `+${added.toLocaleString('pt-BR')} no plano` : 'Já no plano';
      btn.style.background = 'rgba(92,184,122,0.15)';
      btn.style.color = '#5cb87a';
      btn.style.border = '0.5px solid rgba(92,184,122,0.4)';
      setTimeout(() => popup.remove(), 1400);
    });

    el?.querySelector('[data-action="drill"]')?.addEventListener('click', () => {
      handleDrillZoom(h3Id);
    });

    popupRef.current = popup;
    popup.on('close', () => {
      popupRef.current = null;
      // Clear active state on the hex that was highlighted
      const mm = mapRef.current;
      if (mm && activeHexRef.current && mm.getSource('erb-dominance')) {
        try { mm.setFeatureState({ source: 'erb-dominance', id: activeHexRef.current }, { active: false }); } catch {}
        activeHexRef.current = null;
      }
    });
  }, [handleAddHexToCart, handleDrillZoom]);

  // Keep ref pointed at the latest openHexPopup so the one-time click handler
  // registered in onMapReady always calls the current version.
  useEffect(() => {
    openHexPopupRef.current = openHexPopup;
  }, [openHexPopup]);


  const onFilter = useCallback((nf: ERB[]) => { setFiltered(nf); }, []);


  const focusStation = useCallback((i: number) => {
    const e = filteredRef.current[i];
    if (!e?.lat || !e?.lng || !mapRef.current) return;
    mapRef.current.flyTo({ center: [e.lng, e.lat], zoom: Math.max(mapRef.current.getZoom(), 13), speed: 1.4 });
    setActiveIdx(i);
    setTimeout(() => openPopup(i, [e.lng, e.lat]), 400);
  }, [openPopup]);

  const clearCart = useCallback(() => {
    if (cart.size > 10 && !confirm(`Remover ${cart.size} ERBs do plano?`)) return;
    setCart(new Set());
  }, [cart.size]);
  const selectAll = useCallback(() => {
    setCart(p => { const n = new Set(p); filteredRef.current.forEach(e => n.add(e.id)); return n; });
  }, []);

  const summary = useMemo(() => {
    if (!cart.size) return null;
    const sel = allErbs.filter(e => cart.has(e.id));
    const a = sel.reduce((s, e) => s + estimateCellAudience(e.tech_principal, e.uf, e.freq_mhz?.[0] ?? 0), 0);
    const u = [...new Set(sel.map(e => e.uf))];
    return <span><strong className="text-[var(--text-primary)] font-semibold">{formatAudience(a)}</strong> devices · {u.length} UFs</span>;
  }, [cart, allErbs]);

  const ckStations = useMemo(() =>
    allErbs.filter(e => cart.has(e.id)).map(e => ({
      tipo: e.tech_principal, frequencia: e.faixas?.[0] || '', municipio: e.municipio, uf: e.uf,
      audience: estimateCellAudience(e.tech_principal, e.uf, e.freq_mhz?.[0] ?? 0),
    })), [cart, allErbs]);


  const opCounts = useMemo(() => {
    const m: Record<string, number> = {};
    for (const e of filtered) m[e.prestadora_norm] = (m[e.prestadora_norm] || 0) + 1;
    return m;
  }, [filtered]);


  return (<>
    <div className="flex flex-1 h-full min-h-0 overflow-hidden">
      {/* Sidebar */}
      <aside aria-label="Filtros e ERBs"
        className="hidden md:flex w-[290px] flex-col bg-[var(--bg-surface)] border-r border-[var(--border)] shrink-0 overflow-hidden">
        {loading ? (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center">
              <div className="w-8 h-8 border-2 border-[var(--accent)] border-t-transparent rounded-full animate-spin mx-auto mb-3" />
              <div className="text-[12px] text-[var(--text-muted)]">Carregando ERBs...</div>
            </div>
          </div>
        ) : (<>
          <CellFilters erbs={allErbs} onFilter={onFilter} filterOptions={filterOptions} />
          <CellStationList erbs={filtered} cart={cart} activeIdx={activeIdx}
            onFocus={focusStation} onToggleCart={toggleCart} onClearCart={clearCart}
            onSelectAll={selectAll} totalCount={filtered.length} />
        </>)}
      </aside>

      <MapContainer onMapReady={onMapReady}>
        {/* View mode selector */}
        {!loading && (
          <ViewModeSelector mode={viewMode} onChange={handleViewModeChange} />
        )}

        {/* Dominance stats panel */}
        {viewMode === 'dominance' && !loading && (
          <DominancePanel
            zoom={mapZoom}
            onOptionsChange={handleDomOptsChange}
            onAddVisibleToCart={handleAddVisibleToCart}
            getVisibleErbCount={handleGetVisibleErbCount}
          />
        )}

        {/* Legend — hidden in dominance mode (panel has the info) */}
        <CellLegend viewMode={viewMode} opCounts={opCounts} />

        {/* Loading overlay */}
        {loading && (
          <div className="absolute inset-0 z-20 flex items-center justify-center bg-[var(--bg)]" style={{ opacity: 0.9 }}>
            <div className="text-center">
              <div className="w-10 h-10 border-2 border-[var(--accent)] border-t-transparent rounded-full animate-spin mx-auto mb-4" />
              <div className="text-[13px] font-semibold text-[var(--text-primary)]">Carregando ERBs</div>
              <div className="text-[12px] text-[var(--text-muted)] mt-1.5">
                {loadProgress > 0 ? `${loadProgress.toLocaleString('pt-BR')} estações...` : 'Estações Rádio Base · Anatel Fev/2026'}
              </div>
            </div>
          </div>
        )}

        {/* Mobile FAB */}
        <button onClick={() => setDrawerOpen(true)} aria-label="Filtros"
          className="md:hidden absolute top-3.5 left-3.5 z-10 w-10 h-10 rounded-[10px] flex items-center justify-center text-[var(--text-muted)] hover:text-[var(--accent)] cursor-pointer overlay-panel">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="4" y1="6" x2="20" y2="6"/><line x1="4" y1="12" x2="14" y2="12"/><line x1="4" y1="18" x2="18" y2="18"/></svg>
          {filtered.length !== allErbs.length && (
            <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-[var(--accent)] text-[var(--on-accent)] text-[9px] font-bold flex items-center justify-center">!</span>
          )}
        </button>

        {/* Coverage radius toggle */}
        {viewMode === 'pins' && !loading && (
          <button onClick={toggleCoverage} aria-label="Raios de cobertura" aria-pressed={showCoverage}
            className={`absolute bottom-3.5 left-3.5 z-10 flex items-center gap-2 px-4 py-2 rounded-[10px] border-[0.5px] text-[11px] font-medium cursor-pointer transition-all duration-200
              ${showCoverage
                ? 'bg-[var(--accent-muted)] border-[var(--accent)] text-[var(--accent)]'
                : 'overlay-panel text-[var(--text-muted)] hover:text-[var(--accent)] hover:border-[var(--accent)]'}`}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/></svg>
            Raios {showCoverage ? 'ON' : 'OFF'}
          </button>
        )}
      </MapContainer>
    </div>

    <MobileDrawer open={drawerOpen} onClose={() => setDrawerOpen(false)} title="Filtros">
      <CellFilters erbs={allErbs} onFilter={onFilter} filterOptions={filterOptions} />
    </MobileDrawer>

    <SelectionBar count={cart.size} summary={summary}
      onCheckout={() => setCheckoutOpen(true)}
      onDownload={isHypr ? () => exportCellCSV(allErbs, cart) : login}
      canDownload={isHypr} />
    <CheckoutModal open={checkoutOpen} onClose={() => setCheckoutOpen(false)} stations={ckStations} />
  </>);
}
