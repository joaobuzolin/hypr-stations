import { useState, useCallback, useRef, useMemo, useEffect } from 'react';
import maplibregl from 'maplibre-gl';
import type { Map as MLMap, GeoJSONSource } from 'maplibre-gl';
import MapContainer from '../shared/MapContainer';
import SelectionBar from '../shared/SelectionBar';
import CheckoutModal from '../shared/CheckoutModal';
import { useAuth } from '../shared/AuthProvider';
import CellFilters from './CellFilters';
import CellStationList from './CellStationList';
import ViewModeSelector from './ViewModeSelector';
import DominancePanel from './DominancePanel';
import { fetchERBs, getFilterOptions, type ERB } from './cellData';
import { OPERADORA_COLORS, TECH_COLORS } from '../../lib/constants';
import { formatAudience, estimateCellAudience, estimateCellRadius } from '../../lib/audience';
import { addHeatmapLayer, removeHeatmapLayer, addDominanceLayer, removeDominanceLayer, updateDominanceForZoom } from './analysisLayers';
import { updateCoverageCircles, removeCoverageCircles } from './coverageLayer';

// ─── CSV export ──────────────────────────────────

function downloadCSV(erbs: ERB[], cart: Set<number>) {
  const sel = erbs.filter(e => cart.has(e.id));
  if (!sel.length) return;
  const h = ['operadora', 'uf', 'municipio', 'lat', 'lng', 'tech_principal', 'tecnologias', 'faixas', 'coord_source'];
  const rows = [
    h.join(','),
    ...sel.map(e => [
      e.prestadora_norm, e.uf, `"${e.municipio}"`, e.lat, e.lng,
      e.tech_principal, `"${e.tecnologias.join(';')}"`, `"${e.faixas?.join(';')}"`, e.coord_source,
    ].join(',')),
  ];
  const blob = new Blob(['\uFEFF' + rows.join('\n')], { type: 'text/csv;charset=utf-8;' });
  const a = Object.assign(document.createElement('a'), {
    href: URL.createObjectURL(blob),
    download: 'HYPR_CellMap_' + new Date().toISOString().slice(0, 10) + '.csv',
  });
  document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(a.href);
}

// ─── Main component ──────────────────────────────

export default function CellMap() {
  const { isHypr, login } = useAuth();
  const [allErbs, setAllErbs] = useState<ERB[]>([]);
  const [filtered, setFiltered] = useState<ERB[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadProgress, setLoadProgress] = useState(0);
  const [cart, setCart] = useState<Set<number>>(new Set());
  const [activeIdx, setActiveIdx] = useState<number | null>(null);
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [viewMode, setViewMode] = useState<string>('pins');
  const [showCoverage, setShowCoverage] = useState(false);
  const mapRef = useRef<MLMap | null>(null);
  const popupRef = useRef<maplibregl.Popup | null>(null);
  const viewModeRef = useRef<string>('pins');
  const coverageRef = useRef(false);

  // Load data
  useEffect(() => {
    fetchERBs((n) => setLoadProgress(n)).then(data => {
      setAllErbs(data);
      setFiltered(data);
      setLoading(false);
    }).catch(err => {
      console.error('Failed to load ERBs:', err);
      setLoading(false);
    });
  }, []);

  const filterOptions = useMemo(() => getFilterOptions(allErbs), [allErbs]);

  // ─── GeoJSON Layer rendering (native MapLibre, no DOM markers) ───

  const clearLayers = useCallback(() => {
    const map = mapRef.current;
    if (!map) return;
    ['cell-clusters', 'cell-cluster-count', 'cell-points'].forEach(id => {
      if (map.getLayer(id)) map.removeLayer(id);
    });
    if (map.getSource('cell-erb')) map.removeSource('cell-erb');
  }, []);

  const renderLayers = useCallback(() => {
    const map = mapRef.current;
    if (!map || !filtered.length) return;

    clearLayers();

    const geojson: GeoJSON.FeatureCollection = {
      type: 'FeatureCollection',
      features: filtered.filter(e => e.lat && e.lng).map((e, i) => ({
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
        // Track all operators in cluster
        vivo: ['+', ['case', ['==', ['get', 'op'], 'Vivo'], 1, 0]],
        claro: ['+', ['case', ['==', ['get', 'op'], 'Claro'], 1, 0]],
        tim: ['+', ['case', ['==', ['get', 'op'], 'TIM'], 1, 0]],
        brisanet: ['+', ['case', ['==', ['get', 'op'], 'Brisanet'], 1, 0]],
        algar: ['+', ['case', ['==', ['get', 'op'], 'Algar'], 1, 0]],
        unifique: ['+', ['case', ['==', ['get', 'op'], 'Unifique'], 1, 0]],
      },
    });

    // Helper: build operator color expression for MapLibre
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

    // Cluster dominant color expression — pick operator with most ERBs
    const clusterColorExpr: any = [
      'case',
      ['all',
        ['>=', ['get', 'vivo'], ['get', 'claro']],
        ['>=', ['get', 'vivo'], ['get', 'tim']],
        ['>=', ['get', 'vivo'], ['get', 'brisanet']],
      ], OPERADORA_COLORS.Vivo,
      ['all',
        ['>=', ['get', 'claro'], ['get', 'vivo']],
        ['>=', ['get', 'claro'], ['get', 'tim']],
        ['>=', ['get', 'claro'], ['get', 'brisanet']],
      ], OPERADORA_COLORS.Claro,
      ['all',
        ['>=', ['get', 'tim'], ['get', 'vivo']],
        ['>=', ['get', 'tim'], ['get', 'claro']],
        ['>=', ['get', 'tim'], ['get', 'brisanet']],
      ], OPERADORA_COLORS.TIM,
      ['all',
        ['>=', ['get', 'brisanet'], ['get', 'vivo']],
        ['>=', ['get', 'brisanet'], ['get', 'claro']],
        ['>=', ['get', 'brisanet'], ['get', 'tim']],
      ], OPERADORA_COLORS.Brisanet,
      OPERADORA_COLORS.Outras,
    ];

    // Cluster circles — color by dominant operator
    map.addLayer({
      id: 'cell-clusters',
      type: 'circle',
      source: 'cell-erb',
      filter: ['has', 'point_count'],
      paint: {
        'circle-color': clusterColorExpr,
        'circle-opacity': 0.25,
        'circle-radius': ['step', ['get', 'point_count'], 16, 50, 20, 200, 26, 1000, 34, 5000, 42],
        'circle-stroke-width': 1.5,
        'circle-stroke-color': clusterColorExpr,
        'circle-stroke-opacity': 0.6,
      },
    });

    // Cluster count labels
    map.addLayer({
      id: 'cell-cluster-count',
      type: 'symbol',
      source: 'cell-erb',
      filter: ['has', 'point_count'],
      layout: {
        'text-field': '{point_count_abbreviated}',
        'text-font': ['Noto Sans Regular'],
        'text-size': 12,
      },
      paint: {
        'text-color': clusterColorExpr,
      },
    });

    // Individual points — color by operator
    map.addLayer({
      id: 'cell-points',
      type: 'circle',
      source: 'cell-erb',
      filter: ['!', ['has', 'point_count']],
      paint: {
        'circle-radius': 5,
        'circle-color': opColorExpr('op'),
        'circle-opacity': 0.85,
        'circle-stroke-width': 1,
        'circle-stroke-color': opColorExpr('op'),
        'circle-stroke-opacity': 0.5,
      },
    });

    // Click on cluster → zoom in
    map.on('click', 'cell-clusters', (e) => {
      const feat = map.queryRenderedFeatures(e.point, { layers: ['cell-clusters'] });
      if (!feat.length) return;
      const src = map.getSource('cell-erb') as GeoJSONSource;
      src.getClusterExpansionZoom(feat[0].properties?.cluster_id).then(z => {
        map.easeTo({ center: (feat[0].geometry as GeoJSON.Point).coordinates as [number, number], zoom: z });
      });
    });

    // Click on point → popup
    map.on('click', 'cell-points', (e) => {
      if (!e.features?.length) return;
      const idx = e.features[0].properties?.idx;
      if (idx != null) {
        setActiveIdx(idx);
        openPopup(idx, (e.features[0].geometry as GeoJSON.Point).coordinates as [number, number]);
      }
    });

    // Cursor pointer on hover
    ['cell-clusters', 'cell-points'].forEach(id => {
      map.on('mouseenter', id, () => { map.getCanvas().style.cursor = 'pointer'; });
      map.on('mouseleave', id, () => { map.getCanvas().style.cursor = ''; });
    });
  }, [filtered, clearLayers]);

  // ─── View mode switching ────────────────────────

  const applyViewMode = useCallback((mode: string) => {
    const map = mapRef.current;
    if (!map) return;

    clearLayers();
    removeHeatmapLayer(map);
    removeDominanceLayer(map);
    removeCoverageCircles(map);

    if (mode === 'pins') {
      renderLayers();
      if (coverageRef.current) updateCoverageCircles(map, filtered, true);
    } else if (mode === 'heatmap') {
      addHeatmapLayer(map, filtered);
    } else if (mode === 'dominance') {
      addDominanceLayer(map, filtered);
    }
  }, [filtered, renderLayers, clearLayers]);

  const handleViewModeChange = useCallback((mode: string) => {
    viewModeRef.current = mode;
    setViewMode(mode);
    applyViewMode(mode);
  }, [applyViewMode]);

  const toggleCoverage = useCallback(() => {
    const next = !coverageRef.current;
    coverageRef.current = next;
    setShowCoverage(next);
    const map = mapRef.current;
    if (map && viewModeRef.current === 'pins') {
      updateCoverageCircles(map, filtered, next);
    }
  }, [filtered]);

  // Re-render when filtered data changes
  useEffect(() => {
    if (filtered.length > 0) {
      applyViewMode(viewModeRef.current);
    }
  }, [filtered]);

  // ─── Map setup ──────────────────────────────────

  const onMapReady = useCallback((map: MLMap) => {
    mapRef.current = map;

    // Native GeoJSON clustering handles move/zoom automatically.
    // Only coverage circles and dominance need updates on zoom.
    const handleMapMove = () => {
      const mode = viewModeRef.current;
      if (mode === 'pins' && coverageRef.current) {
        updateCoverageCircles(map, filtered, true);
      } else if (mode === 'dominance') {
        updateDominanceForZoom(map, filtered);
      }
    };

    map.on('zoomend', handleMapMove);

    // Initial render
    applyViewMode(viewModeRef.current);
  }, [filtered, applyViewMode]);

  // ─── Popup ──────────────────────────────────────

  const openPopup = useCallback((idx: number, coords: [number, number]) => {
    const e = filtered[idx];
    if (!e || !mapRef.current) return;
    if (popupRef.current) popupRef.current.remove();

    const opColor = OPERADORA_COLORS[e.prestadora_norm] || '#7a6e64';
    const techColor = TECH_COLORS[e.tech_principal] || '#576773';
    const radius = estimateCellRadius(e.tech_principal, e.freq_mhz?.[0] ?? 0);
    const aud = estimateCellAudience(e.tech_principal, e.uf, e.freq_mhz?.[0] ?? 0);

    const row = (l: string, v: string) =>
      `<div style="padding:8px 0;border-bottom:0.5px solid var(--border)"><div style="font-size:11px;letter-spacing:0.02em;color:var(--text-muted);margin-bottom:3px">${l}</div><div style="font-size:13px;font-weight:500;color:var(--text-primary)">${v}</div></div>`;

    const techBadges = e.tecnologias.map(t => {
      const c = TECH_COLORS[t] || '#576773';
      return `<span style="display:inline-block;padding:3px 10px;border-radius:6px;font-size:11px;font-weight:600;background:${c}12;color:${c}">${t}</span>`;
    }).join(' ');

    const html = `<div style="font-family:Urbanist,sans-serif;background:var(--bg-surface);color:var(--text-primary)">
      <div style="height:2px;background:${opColor}"></div>
      <div style="padding:18px 20px 0">
        <div style="display:flex;align-items:center;gap:8px;margin-bottom:4px">
          <span style="font-weight:700;font-size:18px;color:${opColor}">${e.prestadora_norm}</span>
          <span style="font-size:11px;color:var(--text-faint);margin-left:auto">${e.num_estacao}</span>
        </div>
        <div style="font-size:13px;font-weight:600;color:var(--text-primary);margin-bottom:8px">${e.municipio} — ${e.uf}</div>
        <div style="margin-bottom:10px">${techBadges}</div>
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr;padding:0 20px">
        ${row('Faixas', e.faixas?.map(f => f + ' MHz').join(', ') || '—')}
        ${row('Alcance estimado', '~' + Math.round(radius) + ' km')}
        ${row('Coordenadas', e.coord_source === 'anatel' ? 'Anatel (real)' : 'Centróide IBGE')}
        ${row('Azimutes', e.azimutes.length ? e.azimutes.join('° · ') + '°' : '—')}
      </div>
      ${aud > 0 ? `<div style="background:var(--bg-surface2);border-radius:10px;padding:16px;text-align:center;margin:10px 20px">
        <div style="font-size:11px;letter-spacing:0.02em;color:var(--text-muted)">População estimada no raio</div>
        <div style="font-weight:700;font-size:20px;color:var(--accent);margin-top:5px;letter-spacing:-0.01em">${formatAudience(aud)} devices</div>
      </div>` : ''}
      ${e.logradouro ? `<div style="font-size:11px;color:var(--text-faint);margin:8px 20px 0">${e.logradouro}</div>` : ''}
      <div style="font-size:11px;color:var(--text-faint);text-align:center;margin:8px 20px 14px;opacity:0.6">Fonte: Anatel/SMP · Modelo HYPR</div>
    </div>`;

    const popup = new maplibregl.Popup({ closeButton: true, closeOnClick: true, maxWidth: '360px', offset: 10 })
      .setLngLat(coords).setHTML(html).addTo(mapRef.current!);
    popupRef.current = popup;
    popup.on('close', () => { popupRef.current = null; });

    // Draw coverage circle
    drawCoverageCircle(e, coords, radius);
  }, [filtered]);

  // ─── Coverage circle ────────────────────────────

  const drawCoverageCircle = useCallback((e: ERB, center: [number, number], radiusKm: number) => {
    const map = mapRef.current;
    if (!map) return;

    const sourceId = 'coverage-circle';
    const layerId = 'coverage-circle-fill';
    const borderLayerId = 'coverage-circle-border';

    // Remove existing
    if (map.getLayer(layerId)) map.removeLayer(layerId);
    if (map.getLayer(borderLayerId)) map.removeLayer(borderLayerId);
    if (map.getSource(sourceId)) map.removeSource(sourceId);

    // Generate circle polygon
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
      data: {
        type: 'Feature',
        geometry: { type: 'Polygon', coordinates: [coords] },
        properties: {},
      },
    });

    map.addLayer({
      id: layerId,
      type: 'fill',
      source: sourceId,
      paint: { 'fill-color': color, 'fill-opacity': 0.08 },
    });

    map.addLayer({
      id: borderLayerId,
      type: 'line',
      source: sourceId,
      paint: { 'line-color': color, 'line-width': 1.5, 'line-opacity': 0.4, 'line-dasharray': [4, 4] },
    });

    // Remove on popup close
    if (popupRef.current) {
      popupRef.current.on('close', () => {
        if (map.getLayer(layerId)) map.removeLayer(layerId);
        if (map.getLayer(borderLayerId)) map.removeLayer(borderLayerId);
        if (map.getSource(sourceId)) map.removeSource(sourceId);
      });
    }
  }, []);

  // ─── Filter handler ─────────────────────────────

  const onFilter = useCallback((nf: ERB[]) => {
    setFiltered(nf);
  }, []);

  // ─── Station focus ──────────────────────────────

  const focusStation = useCallback((i: number) => {
    const e = filtered[i];
    if (!e?.lat || !e?.lng || !mapRef.current) return;
    mapRef.current.flyTo({ center: [e.lng, e.lat], zoom: Math.max(mapRef.current.getZoom(), 13), speed: 1.4 });
    setActiveIdx(i);
    setTimeout(() => openPopup(i, [e.lng, e.lat]), 400);
  }, [filtered, openPopup]);

  // ─── Cart ───────────────────────────────────────

  const toggleCart = useCallback((id: number) => {
    setCart(p => { const n = new Set(p); n.has(id) ? n.delete(id) : n.add(id); return n; });
  }, []);
  const clearCart = useCallback(() => setCart(new Set()), []);
  const selectAll = useCallback(() => {
    setCart(p => { const n = new Set(p); filtered.forEach(e => n.add(e.id)); return n; });
  }, [filtered]);

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

  // ─── Legend counts ──────────────────────────────

  const opCounts = useMemo(() => {
    const m: Record<string, number> = {};
    for (const e of filtered) m[e.prestadora_norm] = (m[e.prestadora_norm] || 0) + 1;
    return m;
  }, [filtered]);

  // ─── Render ─────────────────────────────────────

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
          <DominancePanel erbs={filtered} resolution={mapRef.current ? (
            mapRef.current.getZoom() < 4 ? 2 : mapRef.current.getZoom() < 5 ? 3 :
            mapRef.current.getZoom() < 7 ? 4 : mapRef.current.getZoom() < 9 ? 5 :
            mapRef.current.getZoom() < 11 ? 6 : 7
          ) : 4} />
        )}

        {/* Legend */}
        <div className="absolute bottom-3.5 right-3.5 z-10 rounded-[10px] border-[0.5px] px-4 py-3 pointer-events-none overlay-panel">
          {viewMode === 'heatmap' ? (<>
            <div className="text-[11px] font-medium tracking-[0.03em] text-[var(--text-muted)] mb-2">Densidade</div>
            <div className="flex items-center gap-1 mb-1">
              <div className="h-[3px] flex-1 rounded-full" style={{
                background: 'linear-gradient(to right, rgba(33,102,172,0.4), rgba(51,151,185,0.6), rgba(102,194,165,0.7), rgba(237,217,0,0.8), rgba(245,39,43,0.85))'
              }} />
            </div>
            <div className="flex justify-between text-[11px] text-[var(--text-faint)]">
              <span>Baixa</span><span>Alta</span>
            </div>
          </>) : viewMode === 'dominance' ? (<>
            <div className="text-[11px] font-medium tracking-[0.03em] text-[var(--text-muted)] mb-2">Dominância</div>
            <div className="text-[11px] text-[var(--text-muted)] mb-1">Cor = operadora com mais ERBs na região</div>
            <div className="text-[11px] text-[var(--text-faint)]">Opacidade = grau de domínio</div>
          </>) : (<>
            <div className="text-[11px] font-medium tracking-[0.03em] text-[var(--text-muted)] mb-2.5">Operadoras</div>
            {Object.entries(opCounts).sort((a, b) => b[1] - a[1]).slice(0, 6).map(([op, n]) => (
              <div key={op} className="flex items-center gap-2 text-[12px] text-[var(--text-primary)] mb-1.5">
                <span className="w-[7px] h-[7px] rounded-full shrink-0"
                  style={{ background: OPERADORA_COLORS[op] || OPERADORA_COLORS['Outras'] }} />
                {op} — {n.toLocaleString('pt-BR')}
              </div>
            ))}
          </>)}
          <div className="text-[11px] text-[var(--text-faint)] mt-2">Anatel · Fev/2026</div>
        </div>

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

    {/* Mobile drawer */}
    {drawerOpen && (<>
      <div className="fixed inset-0 z-[1500] bg-[var(--overlay)]" style={{ backdropFilter: 'blur(2px)' }} onClick={() => setDrawerOpen(false)} />
      <div className="fixed bottom-0 left-0 right-0 z-[1600] bg-[var(--bg-surface)] rounded-t-[16px] border-t border-[var(--border)] max-h-[85vh] flex flex-col animate-[slideUp_0.3s_cubic-bezier(0.32,0.72,0,1)]">
        <div className="w-9 h-1 bg-[var(--border-hover)] rounded-full mx-auto mt-3" />
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-[var(--border)]">
          <span className="text-[13px] font-semibold text-[var(--text-primary)]">Filtros</span>
          <button onClick={() => setDrawerOpen(false)}
            className="w-7 h-7 rounded-lg bg-[var(--bg-surface2)] text-[var(--text-muted)] hover:bg-[var(--bg-surface3)] flex items-center justify-center cursor-pointer text-[13px] transition-colors">×</button>
        </div>
        <div className="overflow-y-auto flex-1">
          <CellFilters erbs={allErbs} onFilter={onFilter} filterOptions={filterOptions} />
          <div className="p-5">
            <button onClick={() => setDrawerOpen(false)}
              className="w-full py-3 rounded-[10px] bg-[var(--accent)] text-[var(--on-accent)] font-heading font-semibold text-[13px] cursor-pointer hover:opacity-90 transition-opacity">
              Aplicar</button>
          </div>
        </div>
      </div>
    </>)}

    <SelectionBar count={cart.size} summary={summary}
      onCheckout={isHypr ? () => setCheckoutOpen(true) : login}
      onDownload={isHypr ? () => downloadCSV(allErbs, cart) : login}
      canDownload={isHypr} />
    <CheckoutModal open={checkoutOpen} onClose={() => setCheckoutOpen(false)} stations={ckStations} />
  </>);
}
