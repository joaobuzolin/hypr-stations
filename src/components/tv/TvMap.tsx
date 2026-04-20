import { useState, useCallback, useRef, useMemo, useEffect } from 'react';
import type { Map as MLMap, GeoJSONSource } from 'maplibre-gl';
import MapContainer from '../shared/MapContainer';
import SelectionBar from '../shared/SelectionBar';
import CheckoutModal from '../shared/CheckoutModal';
import MobileDrawer from '../shared/MobileDrawer';
import MapOverlayPopup from '../shared/MapOverlayPopup';
import TvFilters from './TvFilters';
import TvStationList from './TvStationList';
import TvPinPopupContent from './TvPinPopupContent';
import TvModeSelector, { type TvMode } from './TvModeSelector';
import { loadTvData, loadRetransmitters, type TvStation, type TvData } from './tvData';
import {
  TV_LAYERS,
  buildStationsGeoJSON,
  installStationsLayer,
  updateStationsData,
  highlightStation,
} from './tvLayers';
import { TV_NETWORK_COLORS, TV_NETWORK_NAMES } from '../../lib/constants';
import { downloadCSV } from '../../lib/csv';

const TV_CSV_HEADERS = [
  'tipo', 'municipio', 'uf', 'canal', 'canal_virtual',
  'erp_kw', 'altura_antena', 'entidade', 'rede_id', 'nome_fantasia',
  'status', 'lat', 'lng',
];

function exportTvCSV(cart: Set<number>, allStations: TvStation[]) {
  const sel = [...cart]
    .map(sid => allStations.find(s => s._sid === sid))
    .filter(Boolean) as TvStation[];
  if (!sel.length) return;
  downloadCSV(
    TV_CSV_HEADERS,
    sel as unknown as Record<string, unknown>[],
    'HYPR_TvMap_' + new Date().toISOString().slice(0, 10) + '.csv'
  );
}

export default function TvMap() {
  const [mode, setMode] = useState<TvMode>('cobertura');
  const [data, setData] = useState<TvData | null>(null);
  const [filtered, setFiltered] = useState<TvStation[]>([]);
  const [cart, setCart] = useState<Set<number>>(new Set());
  const [activeIdx, setActiveIdx] = useState<number | null>(null);
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [selectionBarHeight, setSelectionBarHeight] = useState(0);
  const [rtvLoading, setRtvLoading] = useState(false);

  const mapRef = useRef<MLMap | null>(null);
  const [mapInstance, setMapInstance] = useState<MLMap | null>(null);
  const [popup, setPopup] = useState<{ station: TvStation; lngLat: [number, number] } | null>(null);

  // Handlers live across renders; closures reference the latest filtered
  // list via ref to avoid stale data on map click.
  const filteredRef = useRef<TvStation[]>([]);
  useEffect(() => { filteredRef.current = filtered; }, [filtered]);

  useEffect(() => {
    loadTvData().then(d => {
      setData(d);
      setFiltered(d.stations);
    });
  }, []);

  const allStations = data?.stations ?? [];

  const onMapReady = useCallback((map: MLMap) => {
    mapRef.current = map;
    setMapInstance(map);

    const apply = () => {
      installStationsLayer(map, buildStationsGeoJSON(filteredRef.current));

      map.on('click', TV_LAYERS.clusters, (e) => {
        const feat = map.queryRenderedFeatures(e.point, { layers: [TV_LAYERS.clusters] });
        if (!feat.length) return;
        const clusterId = feat[0].properties?.cluster_id;
        const src = map.getSource(TV_LAYERS.stationsSource) as GeoJSONSource;
        src.getClusterExpansionZoom(clusterId).then(z => {
          map.easeTo({
            center: (feat[0].geometry as GeoJSON.Point).coordinates as [number, number],
            zoom: z as number,
          });
        }).catch(() => {});
      });

      [TV_LAYERS.pointsTvd, TV_LAYERS.pointsRtv].forEach(layerId => {
        map.on('click', layerId, (e) => {
          if (!e.features?.length) return;
          const sid = e.features[0].properties?._sid;
          if (sid == null) return;
          const station = filteredRef.current.find(s => s._sid === sid);
          if (!station) return;
          const coords = (e.features[0].geometry as GeoJSON.Point).coordinates as [number, number];
          setPopup({ station, lngLat: coords });
          highlightStation(map, sid);
          const idx = filteredRef.current.findIndex(s => s._sid === sid);
          if (idx >= 0) setActiveIdx(idx);
        });
      });

      [TV_LAYERS.clusters, TV_LAYERS.pointsTvd, TV_LAYERS.pointsRtv].forEach(id => {
        map.on('mouseenter', id, () => { map.getCanvas().style.cursor = 'pointer'; });
        map.on('mouseleave', id, () => { map.getCanvas().style.cursor = ''; });
      });
    };

    if (map.isStyleLoaded()) apply();
    else map.once('load', apply);
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !map.getSource(TV_LAYERS.stationsSource)) return;
    updateStationsData(map, buildStationsGeoJSON(filtered));
  }, [filtered]);

  const toggleCart = useCallback((sid: number) => {
    setCart(p => {
      const n = new Set(p);
      if (n.has(sid)) n.delete(sid); else n.add(sid);
      return n;
    });
  }, []);

  const onFilter = useCallback((nf: TvStation[]) => {
    setFiltered(nf);
  }, []);

  const focusStation = useCallback((i: number) => {
    setActiveIdx(i);
    const s = filtered[i];
    if (!s || !mapRef.current) return;
    mapRef.current.easeTo({
      center: [s.lng, s.lat],
      zoom: Math.max(mapRef.current.getZoom(), 9),
      duration: 600,
    });
    setPopup({ station: s, lngLat: [s.lng, s.lat] });
    highlightStation(mapRef.current, s._sid);
    setDrawerOpen(false);
  }, [filtered]);

  const clearCart = useCallback(() => setCart(new Set()), []);
  const selectAll = useCallback(() => {
    setCart(p => {
      const n = new Set(p);
      filtered.forEach(s => n.add(s._sid));
      return n;
    });
  }, [filtered]);

  const requestRtv = useCallback(() => {
    if (rtvLoading || data?.retransmittersLoaded) return;
    setRtvLoading(true);
    loadRetransmitters().then(() => {
      loadTvData().then(d => { setData(d); });
    }).finally(() => setRtvLoading(false));
  }, [rtvLoading, data?.retransmittersLoaded]);

  const summary = useMemo(() => {
    if (cart.size === 0) return null;
    const stations = [...cart].map(sid => allStations.find(s => s._sid === sid)).filter(Boolean) as TvStation[];
    const ufs = [...new Set(stations.map(s => s.uf))];
    const redes = [...new Set(stations.map(s => s.rede_id))];
    return (
      <>
        {stations.length} estações
        {ufs.length > 0 && <> · {ufs.length} {ufs.length === 1 ? 'UF' : 'UFs'}</>}
        {redes.length > 0 && <> · {redes.map(r => TV_NETWORK_NAMES[r] || r).slice(0, 3).join(', ')}{redes.length > 3 ? '…' : ''}</>}
      </>
    );
  }, [cart, allStations]);

  const ckStations = useMemo(() =>
    [...cart]
      .map(sid => allStations.find(s => s._sid === sid))
      .filter(Boolean)
      .map(s => {
        const st = s as TvStation;
        const rede = TV_NETWORK_NAMES[st.rede_id] || 'TV';
        return {
          tipo: st.tipo === 'TVD' ? rede : `RTV ${rede}`,
          frequencia: `Ch. ${st.canal_virtual || st.canal}`,
          municipio: st.municipio,
          uf: st.uf,
        };
      })
  , [cart, allStations]);

  const counts = useMemo(() => {
    const byRede = new Map<string, number>();
    filtered.forEach(s => {
      if (s.tipo !== 'TVD') return;
      byRede.set(s.rede_id, (byRede.get(s.rede_id) || 0) + 1);
    });
    return byRede;
  }, [filtered]);

  return (<>
    <div className="flex flex-1 h-full min-h-0 overflow-hidden">
      <aside aria-label="Filtros e estações"
        className="hidden md:flex w-[260px] lg:w-[290px] flex-col bg-[var(--bg-surface)] border-r border-[var(--border)] shrink-0 overflow-hidden">
        <TvFilters
          stations={allStations} onFilter={onFilter}
          allUFs={data?.allUFs ?? []} allRedes={data?.allRedes ?? []} allStatus={data?.allStatus ?? []}
          onRequestRtv={requestRtv}
          rtvLoaded={!!data?.retransmittersLoaded}
        />
        <TvStationList
          stations={filtered} cart={cart} activeIdx={activeIdx}
          onFocus={focusStation} onToggleCart={toggleCart}
          onClearCart={clearCart} onSelectAll={selectAll}
          totalCount={filtered.length}
        />
      </aside>

      <MapContainer onMapReady={onMapReady}>
        <TvModeSelector mode={mode} onChange={setMode} />

        {mode === 'audiencia' && (
          <div
            className="absolute top-16 left-1/2 -translate-x-1/2 z-10 max-w-[400px] px-5 py-4
                       rounded-[10px] border-[0.5px] text-center overlay-panel"
          >
            <div className="text-[12px] font-medium text-[var(--text-primary)] mb-1">
              Modo Audiência — em breve
            </div>
            <div className="text-[11px] text-[var(--text-muted)] leading-[1.5]">
              Penetração de TV paga, operadora dominante, cord-cutters por município.
              Chega no próximo release.
            </div>
          </div>
        )}

        {mode === 'cobertura' && counts.size > 0 && (
          <div
            style={{ bottom: `calc(var(--bottom-safe, 0px) + ${selectionBarHeight > 0 ? selectionBarHeight + 14 : 14}px)` }}
            className="absolute right-3.5 z-10 rounded-[10px] border-[0.5px] px-4 py-3 pointer-events-none overlay-panel transition-[bottom] duration-200">
            <div className="text-[11px] font-medium tracking-[0.03em] text-[var(--text-muted)] mb-2.5">Rede</div>
            <div className="flex flex-col gap-1.5">
              {[...counts.entries()]
                .sort((a, b) => b[1] - a[1])
                .slice(0, 6)
                .map(([rede, count]) => (
                  <div key={rede} className="flex items-center gap-2 text-[12px] text-[var(--text-primary)]">
                    <span
                      className="w-[7px] h-[7px] rounded-full"
                      style={{ background: TV_NETWORK_COLORS[rede] || TV_NETWORK_COLORS.outras }}
                      aria-hidden="true"
                    />
                    {TV_NETWORK_NAMES[rede] || rede} — {count.toLocaleString('pt-BR')}
                  </div>
                ))}
            </div>
            <div className="text-[11px] text-[var(--text-muted)] mt-2">Anatel/Mosaico · 2026</div>
          </div>
        )}

        <button onClick={() => setDrawerOpen(true)} aria-label="Filtros"
          className="md:hidden absolute top-3.5 left-3.5 z-10 w-10 h-10 rounded-[10px] flex items-center justify-center text-[var(--text-muted)] hover:text-[var(--accent)] cursor-pointer overlay-panel">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <line x1="4" y1="6" x2="20" y2="6"/><line x1="4" y1="12" x2="14" y2="12"/><line x1="4" y1="18" x2="18" y2="18"/></svg>
          {filtered.length !== allStations.length && (
            <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-[var(--accent)] text-[var(--on-accent)] text-[9px] font-bold flex items-center justify-center">!</span>
          )}
        </button>

        <MapOverlayPopup
          map={mapInstance}
          lngLat={popup?.lngLat || null}
          onClose={() => {
            setPopup(null);
            if (mapRef.current) highlightStation(mapRef.current, null);
          }}
        >
          {popup && (
            <TvPinPopupContent
              station={popup.station}
              inCart={cart.has(popup.station._sid)}
              onAddToCart={() => {
                toggleCart(popup.station._sid);
              }}
            />
          )}
        </MapOverlayPopup>
      </MapContainer>
    </div>

    <MobileDrawer open={drawerOpen} onClose={() => setDrawerOpen(false)} title="Filtros">
      <TvFilters
        stations={allStations} onFilter={onFilter}
        allUFs={data?.allUFs ?? []} allRedes={data?.allRedes ?? []} allStatus={data?.allStatus ?? []}
        onRequestRtv={requestRtv}
        rtvLoaded={!!data?.retransmittersLoaded}
      />
    </MobileDrawer>

    <SelectionBar
      count={cart.size}
      summary={summary}
      onCheckout={() => setCheckoutOpen(true)}
      onDownload={() => exportTvCSV(cart, allStations)}
      canDownload={true}
      onHeightChange={setSelectionBarHeight}
    />
    <CheckoutModal
      open={checkoutOpen}
      onClose={() => setCheckoutOpen(false)}
      stations={ckStations}
      breakdown={null}
    />
  </>);
}
