import { useState, useCallback, useRef, useMemo, useEffect } from 'react';
import type { Map as MLMap, GeoJSONSource } from 'maplibre-gl';
import MapContainer from '../shared/MapContainer';
import SelectionBar from '../shared/SelectionBar';
import CheckoutModal from '../shared/CheckoutModal';
import { useAuth } from '../shared/AuthProvider';
import RadioFilters from './RadioFilters';
import StationList from './StationList';
import MobileDrawer from '../shared/MobileDrawer';
import MapOverlayPopup from '../shared/MapOverlayPopup';
import RadioPinPopupContent from './RadioPinPopupContent';
import { loadRadioData, type RadioStation, type RadioData } from './radioData';
import { RADIO_COLORS } from '../../lib/constants';
import { formatAudience, estimateRadioSelection } from '../../lib/audience';
import { preloadPopulation } from '../../lib/populationData';
import { downloadCSV } from '../../lib/csv';

const RADIO_CSV_HEADERS = ['tipo','municipio','uf','frequencia','classe','categoria','erp','entidade','carater','finalidade','lat','lng'];

function exportRadioCSV(cart: Set<number>, allStations: RadioStation[]) {
  const sel = [...cart].map(sid => allStations.find(s => s._sid === sid)).filter(Boolean) as RadioStation[];
  if (!sel.length) return;
  downloadCSV(RADIO_CSV_HEADERS, sel as unknown as Record<string, unknown>[], 'HYPR_RadioMap_' + new Date().toISOString().slice(0, 10) + '.csv');
}

export default function RadioMap() {
  const { isHypr, login } = useAuth();
  const [data, setData] = useState<RadioData | null>(null);
  const [filtered, setFiltered] = useState<RadioStation[]>([]);
  const [cart, setCart] = useState<Set<number>>(new Set());
  const [activeIdx, setActiveIdx] = useState<number | null>(null);
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  // Reported live by SelectionBar's ResizeObserver; 0 when cart is empty.
  const [selectionBarHeight, setSelectionBarHeight] = useState(0);
  const mapRef = useRef<MLMap | null>(null);
  // State mirror so MapOverlayPopup receives the map as a prop that
  // triggers re-render when it becomes available.
  const [mapInstance, setMapInstance] = useState<MLMap | null>(null);
  // React-managed popup state (replaces the maplibregl.Popup pattern, which
  // injected DOM wrappers that leaked light-theme backgrounds in dark mode).
  const [popup, setPopup] = useState<{ station: RadioStation; lngLat: [number, number] } | null>(null);

  // Load station data on mount
  useEffect(() => {
    preloadPopulation();
    loadRadioData().then(d => {
      setData(d);
      setFiltered(d.stations);
    });
  }, []);

  const allStations = data?.stations ?? [];

  const buildGeoJSON = useCallback((data: RadioStation[]) => ({
    type: 'FeatureCollection' as const,
    features: data.filter(s => s.lat != null && s.lng != null && s.lat !== 0).map((s, i) => ({
      type: 'Feature' as const, geometry: { type: 'Point' as const, coordinates: [s.lng, s.lat] },
      properties: { idx: i, tipo: s.tipo, _sid: s._sid },
    })),
  }), []);

  const onMapReady = useCallback((map: MLMap) => {
    mapRef.current = map;
    setMapInstance(map);
    const gj = buildGeoJSON(filtered);
    ['cluster-count','clusters','points-fm','points-om'].forEach(id => { if (map.getLayer(id)) map.removeLayer(id); });
    if (map.getSource('stations')) map.removeSource('stations');

    map.addSource('stations', { type: 'geojson', data: gj, cluster: true, clusterMaxZoom: 12, clusterRadius: 50 });

    // Clusters — solid accent with white text, like original
    map.addLayer({ id: 'clusters', type: 'circle', source: 'stations', filter: ['has', 'point_count'],
      paint: {
        'circle-color': RADIO_COLORS.fm, 'circle-opacity': 0.3,
        'circle-radius': ['step', ['get', 'point_count'], 18, 50, 24, 200, 32],
        'circle-stroke-width': 1.5, 'circle-stroke-color': RADIO_COLORS.fm, 'circle-stroke-opacity': 0.6,
      }});
    map.addLayer({ id: 'cluster-count', type: 'symbol', source: 'stations', filter: ['has', 'point_count'],
      layout: { 'text-field': '{point_count_abbreviated}', 'text-font': ['Noto Sans Regular'], 'text-size': 12 },
      paint: { 'text-color': RADIO_COLORS.fm }});

    // Points — radius 5, full opacity, visible stroke
    map.addLayer({ id: 'points-fm', type: 'circle', source: 'stations',
      filter: ['all', ['!', ['has', 'point_count']], ['==', ['get', 'tipo'], 'FM']],
      paint: { 'circle-radius': 5, 'circle-color': RADIO_COLORS.fm, 'circle-opacity': 0.9, 'circle-stroke-width': 1, 'circle-stroke-color': RADIO_COLORS.fm, 'circle-stroke-opacity': 0.5 }});
    map.addLayer({ id: 'points-om', type: 'circle', source: 'stations',
      filter: ['all', ['!', ['has', 'point_count']], ['==', ['get', 'tipo'], 'OM']],
      paint: { 'circle-radius': 5, 'circle-color': RADIO_COLORS.am, 'circle-opacity': 0.9, 'circle-stroke-width': 1, 'circle-stroke-color': RADIO_COLORS.am, 'circle-stroke-opacity': 0.5 }});

    // Interactions
    map.on('click', 'clusters', e => {
      const feat = map.queryRenderedFeatures(e.point, { layers: ['clusters'] });
      if (!feat.length) return;
      (map.getSource('stations') as GeoJSONSource).getClusterExpansionZoom(feat[0].properties?.cluster_id).then(z => {
        map.easeTo({ center: (feat[0].geometry as GeoJSON.Point).coordinates as [number, number], zoom: z });
      });
    });
    ['points-fm','points-om'].forEach(l => {
      map.on('click', l, e => {
        if (!e.features?.length) return;
        const idx = e.features[0].properties?.idx;
        if (idx != null) { setActiveIdx(idx); openPopup(idx, (e.features[0].geometry as GeoJSON.Point).coordinates as [number,number]); }
      });
    });
    ['clusters','points-fm','points-om'].forEach(id => {
      map.on('mouseenter', id, () => { map.getCanvas().style.cursor = 'pointer'; });
      map.on('mouseleave', id, () => { map.getCanvas().style.cursor = ''; });
    });
  }, [filtered, buildGeoJSON]);

  const toggleCart = useCallback((sid: number) => { setCart(p => { const n = new Set(p); n.has(sid) ? n.delete(sid) : n.add(sid); return n; }); }, []);

  const openPopup = useCallback((idx: number, coords: [number, number]) => {
    const s = filtered[idx];
    if (!s || !mapRef.current) return;
    setPopup({ station: s, lngLat: coords });
  }, [filtered]);

  const onFilter = useCallback((nf: RadioStation[]) => {
    setFiltered(nf);
    if (mapRef.current) { const src = mapRef.current.getSource('stations') as GeoJSONSource|undefined; if (src) src.setData(buildGeoJSON(nf)); }
  }, [buildGeoJSON]);

  const focusStation = useCallback((i: number) => {
    const s = filtered[i]; if (!s?.lat || !s?.lng || !mapRef.current) return;
    mapRef.current.flyTo({ center: [s.lng, s.lat], zoom: Math.max(mapRef.current.getZoom(), 12), speed: 1.4 });
    setActiveIdx(i); setTimeout(() => openPopup(i, [s.lng, s.lat]), 400);
  }, [filtered, openPopup]);

  const clearCart = useCallback(() => {
    if (cart.size > 10 && !confirm(`Remover ${cart.size} estações do plano?`)) return;
    setCart(new Set());
  }, [cart.size]);
  const selectAll = useCallback(() => { setCart(p => { const n = new Set(p); filtered.forEach(s => n.add(s._sid)); return n; }); }, [filtered]);

  /** Breakdown agregado da seleção. Calculado uma vez e reutilizado em
   *  summary e CheckoutModal — dedup de sobreposição aplicada internamente. */
  const selectionBreakdown = useMemo(() => {
    if (!cart.size) return null;
    const sel = [...cart]
      .map(sid => allStations.find(s => s._sid === sid))
      .filter(Boolean) as RadioStation[];
    return estimateRadioSelection(sel);
  }, [cart, allStations]);

  const summary = useMemo(() => {
    if (!selectionBreakdown) return null;
    const sel = [...cart]
      .map(sid => allStations.find(s => s._sid === sid))
      .filter(Boolean) as RadioStation[];
    const u = [...new Set(sel.map(e => e.uf))];
    return (
      <span>
        <strong className="text-[var(--text-primary)] font-semibold">
          {formatAudience(selectionBreakdown.population)}
        </strong>
        {' pessoas → '}
        <strong className="text-[var(--accent)] font-semibold">
          {formatAudience(selectionBreakdown.addressable)}
        </strong>
        {' devices · '}{u.length} UFs
      </span>
    );
  }, [selectionBreakdown, cart, allStations]);

  const ckStations = useMemo(() => [...cart]
    .map(sid => allStations.find(s => s._sid === sid))
    .filter(Boolean)
    .map(s => ({
      tipo: s!.tipo, frequencia: s!.frequencia, municipio: s!.municipio, uf: s!.uf,
    })), [cart, allStations]);

  const fmN = useMemo(() => filtered.filter(s => s.tipo === 'FM').length, [filtered]);

  // Loading state while radio-stations.json is being fetched
  if (!data) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-[var(--border)] border-t-[var(--accent)] rounded-full animate-spin mx-auto mb-3" />
          <p className="text-[13px] text-[var(--text-muted)]">Carregando estações…</p>
        </div>
      </div>
    );
  }

  return (<>
    <div className="flex flex-1 h-full min-h-0 overflow-hidden">
      {/* Sidebar — 260px on md, 290px on lg+ */}
      <aside aria-label="Filtros e estações"
        className="hidden md:flex w-[260px] lg:w-[290px] flex-col bg-[var(--bg-surface)] border-r border-[var(--border)] shrink-0 overflow-hidden">
        <RadioFilters stations={allStations} onFilter={onFilter} allUFs={data?.allUFs ?? []} allClasses={data?.allClasses ?? []} allFinalidades={data?.allFinalidades ?? []} />
        <StationList stations={filtered} cart={cart} activeIdx={activeIdx} onFocus={focusStation}
          onToggleCart={toggleCart} onClearCart={clearCart} onSelectAll={selectAll} totalCount={filtered.length} />
      </aside>

      <MapContainer onMapReady={onMapReady}>
        {/* Legend */}
        <div
          style={{ bottom: `calc(var(--bottom-safe, 0px) + ${selectionBarHeight > 0 ? selectionBarHeight + 14 : 14}px)` }}
          className="absolute right-3.5 z-10 rounded-[10px] border-[0.5px] px-4 py-3 pointer-events-none overlay-panel transition-[bottom] duration-200">
          <div className="text-[11px] font-medium tracking-[0.03em] text-[var(--text-muted)] mb-2.5">Legenda</div>
          <div className="flex items-center gap-2 text-[12px] text-[var(--text-primary)] mb-1.5">
            <span className="w-[7px] h-[7px] rounded-full" style={{ background: RADIO_COLORS.fm }} aria-hidden="true" /> FM — {fmN.toLocaleString('pt-BR')}
          </div>
          <div className="flex items-center gap-2 text-[12px] text-[var(--text-primary)]">
            <span className="w-[7px] h-[7px] rounded-full" style={{ background: RADIO_COLORS.am }} aria-hidden="true" /> AM/OM — {(filtered.length - fmN).toLocaleString('pt-BR')}
          </div>
          <div className="text-[11px] text-[var(--text-muted)] mt-2">Anatel/SRD · 2026</div>
        </div>

        {/* Mobile FAB */}
        <button onClick={() => setDrawerOpen(true)} aria-label="Filtros"
          className="md:hidden absolute top-3.5 left-3.5 z-10 w-10 h-10 rounded-[10px] flex items-center justify-center text-[var(--text-muted)] hover:text-[var(--accent)] cursor-pointer overlay-panel">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <line x1="4" y1="6" x2="20" y2="6"/><line x1="4" y1="12" x2="14" y2="12"/><line x1="4" y1="18" x2="18" y2="18"/></svg>
          {filtered.length !== allStations.length && (
            <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-[var(--accent)] text-[var(--on-accent)] text-[9px] font-bold flex items-center justify-center">!</span>
          )}
        </button>

        {/* React-rendered popup — pure app markup, no maplibregl.Popup involvement */}
        <MapOverlayPopup
          map={mapInstance}
          lngLat={popup?.lngLat || null}
          onClose={() => setPopup(null)}
        >
          {popup && (
            <RadioPinPopupContent
              station={popup.station}
              inCart={cart.has(popup.station._sid)}
              onToggleCart={() => {
                toggleCart(popup.station._sid);
                setPopup(null);
              }}
            />
          )}
        </MapOverlayPopup>
      </MapContainer>
    </div>

    <MobileDrawer open={drawerOpen} onClose={() => setDrawerOpen(false)} title="Filtros">
      <RadioFilters stations={allStations} onFilter={onFilter} allUFs={data?.allUFs ?? []} allClasses={data?.allClasses ?? []} allFinalidades={data?.allFinalidades ?? []} />
    </MobileDrawer>

    <SelectionBar count={cart.size} summary={summary} onCheckout={() => setCheckoutOpen(true)} onDownload={isHypr ? () => exportRadioCSV(cart, allStations) : login} canDownload={isHypr} onHeightChange={setSelectionBarHeight} />
    <CheckoutModal open={checkoutOpen} onClose={() => setCheckoutOpen(false)} stations={ckStations} breakdown={selectionBreakdown} />
  </>);
}
