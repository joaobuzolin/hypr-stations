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

  // ── GeoJSON builder ──
  const buildGeoJSON = useCallback((data: RadioStation[]) => ({
    type: 'FeatureCollection' as const,
    features: data.filter(s => s.lat && s.lng).map((s, i) => ({
      type: 'Feature' as const,
      geometry: { type: 'Point' as const, coordinates: [s.lng, s.lat] },
      properties: { idx: i, tipo: s.tipo, _sid: s._sid },
    })),
  }), []);

  // ── Map initialization ──
  const onMapReady = useCallback((map: MLMap) => {
    mapRef.current = map;
    const geojson = buildGeoJSON(filtered);

    // Remove existing layers/source if re-initializing (theme change)
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

    // Cluster circles
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

    // FM points
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

    // AM/OM points
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

    // Click handlers
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

    // Cursor
    ['clusters', 'points-fm', 'points-om'].forEach(id => {
      map.on('mouseenter', id, () => { map.getCanvas().style.cursor = 'pointer'; });
      map.on('mouseleave', id, () => { map.getCanvas().style.cursor = ''; });
    });
  }, [filtered, buildGeoJSON]);

  // ── Popup ──
  const openPopup = useCallback((idx: number, coordinates: [number, number]) => {
    const s = filtered[idx];
    if (!s || !mapRef.current) return;
    if (popupRef.current) popupRef.current.remove();

    const erp = getRadioERP(s.erp, s.classe);
    const radius = Math.round(estimateRadioRadius(erp, s.tipo));
    const aud = estimateRadioAudience(s.erp, s.tipo, s.classe, s.uf);
    const unit = s.tipo === 'FM' ? 'MHz' : 'kHz';

    const html = `
      <div style="padding:14px 18px;min-width:240px;font-family:Urbanist,sans-serif">
        <div style="display:flex;align-items:center;gap:12px;margin-bottom:12px">
          <div style="font-weight:800;font-size:22px;color:${s.tipo === 'FM' ? RADIO_COLORS.fm : RADIO_COLORS.am}">
            ${s.frequencia} <span style="font-size:11px;font-weight:400;color:var(--text-muted)">${unit}</span>
          </div>
          <div>
            <div style="font-size:13px;font-weight:700;color:var(--text-primary)">${s.municipio} — ${s.uf}</div>
            <div style="font-size:11px;color:var(--text-muted)">${s._fantasy || (s.tipo === 'FM' ? 'Rádio FM' : 'Rádio AM/OM')}</div>
          </div>
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:6px">
          <div style="grid-column:1/-1;background:var(--bg-surface2);border-radius:8px;padding:6px 10px">
            <div style="font-size:9px;text-transform:uppercase;letter-spacing:0.08em;color:var(--text-muted)">Entidade</div>
            <div style="font-size:11px;font-weight:500;color:var(--text-primary)">${s.entidade || '—'}</div>
          </div>
          <div style="background:var(--bg-surface2);border-radius:8px;padding:6px 10px">
            <div style="font-size:9px;text-transform:uppercase;letter-spacing:0.08em;color:var(--text-muted)">Classe</div>
            <div style="font-size:12px;font-weight:500;color:var(--text-primary)">${s.classe || '—'}</div>
          </div>
          <div style="background:var(--bg-surface2);border-radius:8px;padding:6px 10px">
            <div style="font-size:9px;text-transform:uppercase;letter-spacing:0.08em;color:var(--text-muted)">ERP / Alcance</div>
            <div style="font-size:12px;font-weight:500;color:var(--text-primary)">${erp.toLocaleString('pt-BR')} W (~${radius} km)</div>
          </div>
          <div style="background:var(--bg-surface2);border-radius:8px;padding:6px 10px">
            <div style="font-size:9px;text-transform:uppercase;letter-spacing:0.08em;color:var(--text-muted)">Finalidade</div>
            <div style="font-size:12px;font-weight:500;color:var(--text-primary)">${s.finalidade || '—'}</div>
          </div>
          <div style="background:var(--bg-surface2);border-radius:8px;padding:6px 10px">
            <div style="font-size:9px;text-transform:uppercase;letter-spacing:0.08em;color:var(--text-muted)">Caráter</div>
            <div style="font-size:12px;font-weight:500;color:var(--text-primary)">${s.carater || '—'}</div>
          </div>
        </div>
        ${aud > 0 ? `
        <div style="background:var(--bg-surface2);border-radius:8px;padding:8px 10px;margin-top:8px;text-align:center">
          <div style="font-size:9px;text-transform:uppercase;letter-spacing:0.08em;color:var(--text-muted)">Audiência Estimada</div>
          <div style="font-weight:800;font-size:18px;color:var(--accent);margin-top:2px">${formatAudience(aud)} devices</div>
        </div>` : ''}
        <div style="font-size:8px;color:var(--text-muted);text-align:center;margin-top:10px;opacity:0.6">
          Modelo HYPR: alcance × densidade × penetração rádio × campanha 30d
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

  // ── Update map data when filters change ──
  const onFilter = useCallback((newFiltered: RadioStation[]) => {
    setFiltered(newFiltered);
    if (mapRef.current) {
      const src = mapRef.current.getSource('stations') as GeoJSONSource | undefined;
      if (src) {
        src.setData(buildGeoJSON(newFiltered));
      }
    }
  }, [buildGeoJSON]);

  // ── Station focus ──
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

  // ── Cart ──
  const toggleCart = useCallback((sid: number) => {
    setCart(prev => {
      const next = new Set(prev);
      if (next.has(sid)) next.delete(sid);
      else next.add(sid);
      return next;
    });
  }, []);

  // ── Selection summary ──
  const selectionSummary = useMemo(() => {
    if (cart.size === 0) return '';
    const selected = [...cart]
      .map(sid => allStations.find(s => s._sid === sid))
      .filter(Boolean) as RadioStation[];
    const totalAud = selected.reduce((s, e) => s + estimateRadioAudience(e.erp, e.tipo, e.classe, e.uf), 0);
    const ufs = [...new Set(selected.map(e => e.uf))];
    return `<strong>${formatAudience(totalAud)}</strong> devices est. · ${ufs.length} UF${ufs.length > 1 ? 's' : ''}`;
  }, [cart]);

  // Count FM/OM in filtered
  const fmCount = useMemo(() => filtered.filter(s => s.tipo === 'FM').length, [filtered]);
  const omCount = useMemo(() => filtered.length - fmCount, [filtered, fmCount]);

  return (
    <AuthProvider>
      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar (desktop) */}
        <aside className="hidden md:flex w-[300px] flex-col bg-[var(--bg-surface)] border-r border-[var(--border)] shrink-0 overflow-hidden">
          <RadioFilters stations={allStations} onFilter={onFilter} />
          <StationList
            stations={filtered}
            cart={cart}
            activeIdx={activeIdx}
            onFocus={focusStation}
            onToggleCart={toggleCart}
            totalCount={filtered.length}
          />
        </aside>

        {/* Map */}
        <MapContainer onMapReady={onMapReady}>
          {/* Legend */}
          <div className="absolute bottom-5 right-5 z-10 rounded-xl border px-4 py-3 pointer-events-none
                          bg-[var(--bg-surface)] border-[var(--border)]">
            <div className="text-[10px] uppercase tracking-widest text-[var(--text-muted)] mb-2">
              Legenda
            </div>
            <div className="flex items-center gap-2 text-xs text-[var(--text-primary)] mb-1">
              <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: RADIO_COLORS.fm }} />
              FM — {fmCount.toLocaleString('pt-BR')}
            </div>
            <div className="flex items-center gap-2 text-xs text-[var(--text-primary)] mb-2">
              <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: RADIO_COLORS.am }} />
              AM/OM — {omCount.toLocaleString('pt-BR')}
            </div>
            <div className="text-[8px] text-[var(--text-muted)] opacity-60">
              Fonte: Anatel/SRD · 2026
            </div>
          </div>
        </MapContainer>
      </div>

      {/* Selection bar */}
      <SelectionBar
        count={cart.size}
        summary={selectionSummary}
        onCheckout={() => {/* TODO: Phase 5 */}}
        canDownload={false}
      />
    </AuthProvider>
  );
}
