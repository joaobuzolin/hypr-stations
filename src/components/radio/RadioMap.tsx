import { useState, useCallback, useRef, useMemo } from 'react';
import maplibregl from 'maplibre-gl';
import type { Map as MLMap, GeoJSONSource } from 'maplibre-gl';
import MapContainer from '../shared/MapContainer';
import SelectionBar from '../shared/SelectionBar';
import AuthProvider from '../shared/AuthProvider';
import RadioFilters from './RadioFilters';
import StationList from './StationList';
import { stations as allStations, type RadioStation } from './radioData';
import { RADIO_COLORS } from '../../lib/constants';
import {
  formatAudience,
  estimateRadioAudience,
  estimateRadioRadius,
  getRadioERP,
} from '../../lib/audience';

export default function RadioMap() {
  const [filtered, setFiltered] = useState<RadioStation[]>(allStations);
  const [cart, setCart] = useState<Set<number>>(new Set());
  const [activeIdx, setActiveIdx] = useState<number | null>(null);
  const mapRef = useRef<MLMap | null>(null);
  const popupRef = useRef<maplibregl.Popup | null>(null);

  const buildGeoJSON = useCallback((data: RadioStation[]) => ({
    type: 'FeatureCollection' as const,
    features: data.filter(s => s.lat && s.lng).map((s, i) => ({
      type: 'Feature' as const,
      geometry: { type: 'Point' as const, coordinates: [s.lng, s.lat] },
      properties: { idx: i, tipo: s.tipo, _sid: s._sid },
    })),
  }), []);

  const onMapReady = useCallback((map: MLMap) => {
    mapRef.current = map;
    const geojson = buildGeoJSON(filtered);

    ['cluster-count', 'clusters', 'points-fm', 'points-om'].forEach(id => {
      if (map.getLayer(id)) map.removeLayer(id);
    });
    if (map.getSource('stations')) map.removeSource('stations');

    map.addSource('stations', {
      type: 'geojson',
      data: geojson,
      cluster: true,
      clusterMaxZoom: 12,
      clusterRadius: 50,
    });

    map.addLayer({
      id: 'clusters',
      type: 'circle',
      source: 'stations',
      filter: ['has', 'point_count'],
      paint: {
        'circle-color': RADIO_COLORS.fm,
        'circle-radius': ['step', ['get', 'point_count'], 16, 50, 22, 200, 28],
        'circle-opacity': 0.25,
        'circle-stroke-width': 1,
        'circle-stroke-color': RADIO_COLORS.fm,
        'circle-stroke-opacity': 0.5,
      },
    });

    map.addLayer({
      id: 'cluster-count',
      type: 'symbol',
      source: 'stations',
      filter: ['has', 'point_count'],
      layout: {
        'text-field': '{point_count_abbreviated}',
        'text-font': ['Open Sans Bold'],
        'text-size': 11,
      },
      paint: { 'text-color': RADIO_COLORS.fm },
    });

    map.addLayer({
      id: 'points-fm',
      type: 'circle',
      source: 'stations',
      filter: ['all', ['!', ['has', 'point_count']], ['==', ['get', 'tipo'], 'FM']],
      paint: {
        'circle-radius': 4,
        'circle-color': RADIO_COLORS.fm,
        'circle-stroke-width': 0.5,
        'circle-stroke-color': RADIO_COLORS.fm,
        'circle-opacity': 0.8,
      },
    });

    map.addLayer({
      id: 'points-om',
      type: 'circle',
      source: 'stations',
      filter: ['all', ['!', ['has', 'point_count']], ['==', ['get', 'tipo'], 'OM']],
      paint: {
        'circle-radius': 4,
        'circle-color': RADIO_COLORS.am,
        'circle-stroke-width': 0.5,
        'circle-stroke-color': RADIO_COLORS.am,
        'circle-opacity': 0.8,
      },
    });

    map.on('click', 'clusters', (e) => {
      const features = map.queryRenderedFeatures(e.point, { layers: ['clusters'] });
      if (!features.length) return;
      const clusterId = features[0].properties?.cluster_id;
      const src = map.getSource('stations') as GeoJSONSource;
      src.getClusterExpansionZoom(clusterId).then((zoom: number) => {
        map.easeTo({ center: (features[0].geometry as GeoJSON.Point).coordinates as [number, number], zoom });
      });
    });

    ['points-fm', 'points-om'].forEach(layerId => {
      map.on('click', layerId, (e) => {
        if (!e.features?.length) return;
        const idx = e.features[0].properties?.idx;
        if (idx != null) {
          setActiveIdx(idx);
          openPopup(idx, (e.features[0].geometry as GeoJSON.Point).coordinates as [number, number]);
        }
      });
    });

    ['clusters', 'points-fm', 'points-om'].forEach(id => {
      map.on('mouseenter', id, () => { map.getCanvas().style.cursor = 'pointer'; });
      map.on('mouseleave', id, () => { map.getCanvas().style.cursor = ''; });
    });
  }, [filtered, buildGeoJSON]);

  // Popup with consistent text sizes: text-micro (10px) for labels, text-xs (12px) for values
  const openPopup = useCallback((idx: number, coordinates: [number, number]) => {
    const s = filtered[idx];
    if (!s || !mapRef.current) return;
    if (popupRef.current) popupRef.current.remove();

    const erp = getRadioERP(s.erp, s.classe);
    const radius = Math.round(estimateRadioRadius(erp, s.tipo));
    const aud = estimateRadioAudience(s.erp, s.tipo, s.classe, s.uf);
    const unit = s.tipo === 'FM' ? 'MHz' : 'kHz';
    const accentColor = s.tipo === 'FM' ? RADIO_COLORS.fm : RADIO_COLORS.am;

    const labelStyle = 'font-size:10px;text-transform:uppercase;letter-spacing:0.06em;color:var(--text-muted);margin-bottom:2px';
    const valueStyle = 'font-size:12px;font-weight:500;color:var(--text-primary)';
    const cellStyle = 'background:var(--bg-surface2);border-radius:8px;padding:6px 10px';

    const html = `
      <div style="padding:14px 16px;min-width:240px;font-family:Urbanist,sans-serif">
        <div style="display:flex;align-items:center;gap:10px;margin-bottom:12px">
          <div style="font-weight:800;font-size:20px;color:${accentColor}">
            ${s.frequencia} <span style="font-size:10px;font-weight:400;color:var(--text-muted)">${unit}</span>
          </div>
          <div>
            <div style="font-size:12px;font-weight:700;color:var(--text-primary)">${s.municipio} — ${s.uf}</div>
            <div style="font-size:10px;color:var(--text-muted)">${s._fantasy || (s.tipo === 'FM' ? 'Rádio FM' : 'Rádio AM/OM')}</div>
          </div>
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:6px">
          <div style="grid-column:1/-1;${cellStyle}">
            <div style="${labelStyle}">Entidade</div>
            <div style="${valueStyle}">${s.entidade || '—'}</div>
          </div>
          <div style="${cellStyle}">
            <div style="${labelStyle}">Classe</div>
            <div style="${valueStyle}">${s.classe || '—'}</div>
          </div>
          <div style="${cellStyle}">
            <div style="${labelStyle}">ERP / Alcance</div>
            <div style="${valueStyle}">${erp.toLocaleString('pt-BR')} W (~${radius} km)</div>
          </div>
          <div style="${cellStyle}">
            <div style="${labelStyle}">Finalidade</div>
            <div style="${valueStyle}">${s.finalidade || '—'}</div>
          </div>
          <div style="${cellStyle}">
            <div style="${labelStyle}">Caráter</div>
            <div style="${valueStyle}">${s.carater || '—'}</div>
          </div>
        </div>
        ${aud > 0 ? `
        <div style="${cellStyle};margin-top:8px;text-align:center">
          <div style="${labelStyle}">Audiência estimada</div>
          <div style="font-weight:800;font-size:18px;color:var(--accent);margin-top:2px">${formatAudience(aud)} devices</div>
        </div>` : ''}
        <div style="font-size:10px;color:var(--text-muted);text-align:center;margin-top:10px">
          Modelo HYPR: alcance × densidade × penetração × campanha 30d
        </div>
      </div>
    `;

    const popup = new maplibregl.Popup({
      closeButton: true,
      closeOnClick: true,
      maxWidth: '320px',
      offset: 10,
    })
      .setLngLat(coordinates)
      .setHTML(html)
      .addTo(mapRef.current!);

    popupRef.current = popup;
    popup.on('close', () => { popupRef.current = null; });
  }, [filtered]);

  const onFilter = useCallback((newFiltered: RadioStation[]) => {
    setFiltered(newFiltered);
    if (mapRef.current) {
      const src = mapRef.current.getSource('stations') as GeoJSONSource | undefined;
      if (src) src.setData(buildGeoJSON(newFiltered));
    }
  }, [buildGeoJSON]);

  const focusStation = useCallback((idx: number) => {
    const s = filtered[idx];
    if (!s || !s.lat || !s.lng || !mapRef.current) return;
    mapRef.current.flyTo({
      center: [s.lng, s.lat],
      zoom: Math.max(mapRef.current.getZoom(), 12),
      speed: 1.4,
    });
    setActiveIdx(idx);
    setTimeout(() => openPopup(idx, [s.lng, s.lat]), 400);
  }, [filtered, openPopup]);

  const toggleCart = useCallback((sid: number) => {
    setCart(prev => {
      const next = new Set(prev);
      if (next.has(sid)) next.delete(sid);
      else next.add(sid);
      return next;
    });
  }, []);

  const clearCart = useCallback(() => setCart(new Set()), []);

  const selectAllFiltered = useCallback(() => {
    setCart(prev => {
      const next = new Set(prev);
      filtered.forEach(s => next.add(s._sid));
      return next;
    });
  }, [filtered]);

  // Selection summary as ReactNode (no dangerouslySetInnerHTML)
  const selectionSummary = useMemo(() => {
    if (cart.size === 0) return null;
    const selected = [...cart]
      .map(sid => allStations.find(s => s._sid === sid))
      .filter(Boolean) as RadioStation[];
    const totalAud = selected.reduce((s, e) => s + estimateRadioAudience(e.erp, e.tipo, e.classe, e.uf), 0);
    const ufs = [...new Set(selected.map(e => e.uf))];
    return (
      <span>
        <strong className="text-[var(--text-primary)] font-semibold">{formatAudience(totalAud)}</strong>
        {' '}devices est. · {ufs.length} UF{ufs.length > 1 ? 's' : ''}
      </span>
    );
  }, [cart]);

  const fmCount = useMemo(() => filtered.filter(s => s.tipo === 'FM').length, [filtered]);
  const omCount = useMemo(() => filtered.length - fmCount, [filtered, fmCount]);

  return (
    <AuthProvider>
      <div className="flex flex-1 overflow-hidden">
        <aside
          aria-label="Filtros e lista de estações"
          className="hidden md:flex w-[300px] flex-col bg-[var(--bg-surface)] border-r border-[var(--border)] shrink-0 overflow-hidden"
        >
          <RadioFilters stations={allStations} onFilter={onFilter} />
          <StationList
            stations={filtered}
            cart={cart}
            activeIdx={activeIdx}
            onFocus={focusStation}
            onToggleCart={toggleCart}
            onClearCart={clearCart}
            onSelectAll={selectAllFiltered}
            totalCount={filtered.length}
          />
        </aside>

        <MapContainer onMapReady={onMapReady}>
          <div className="absolute bottom-5 right-5 z-10 rounded-xl border px-4 py-3 pointer-events-none
                          bg-[var(--bg-surface)] border-[var(--border)]"
               aria-label="Legenda do mapa">
            <div className="text-micro uppercase tracking-widest text-[var(--text-muted)] mb-2">
              Legenda
            </div>
            <div className="flex items-center gap-2 text-xs text-[var(--text-primary)] mb-1">
              <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: RADIO_COLORS.fm }} aria-hidden="true" />
              FM — {fmCount.toLocaleString('pt-BR')}
            </div>
            <div className="flex items-center gap-2 text-xs text-[var(--text-primary)] mb-2">
              <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: RADIO_COLORS.am }} aria-hidden="true" />
              AM/OM — {omCount.toLocaleString('pt-BR')}
            </div>
            <div className="text-micro text-[var(--text-muted)]">
              Fonte: Anatel/SRD · 2026
            </div>
          </div>
        </MapContainer>
      </div>

      <SelectionBar
        count={cart.size}
        summary={selectionSummary}
        onCheckout={() => {/* Phase 5 */}}
        canDownload={false}
      />
    </AuthProvider>
  );
}
