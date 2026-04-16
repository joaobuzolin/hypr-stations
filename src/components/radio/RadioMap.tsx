import { useState, useCallback, useRef, useMemo } from 'react';
import maplibregl from 'maplibre-gl';
import type { Map as MLMap, GeoJSONSource } from 'maplibre-gl';
import MapContainer from '../shared/MapContainer';
import SelectionBar from '../shared/SelectionBar';
import CheckoutModal from '../shared/CheckoutModal';
import { useAuth } from '../shared/AuthProvider';
import RadioFilters from './RadioFilters';
import StationList from './StationList';
import { stations as allStations, type RadioStation } from './radioData';
import { RADIO_COLORS } from '../../lib/constants';
import { formatAudience, estimateRadioAudience, estimateRadioRadius, getRadioERP } from '../../lib/audience';

function downloadCSV(cart: Set<number>) {
  const sel = [...cart].map(sid => allStations.find(s => s._sid === sid)).filter(Boolean) as RadioStation[];
  if (!sel.length) return;
  const h = ['tipo','municipio','uf','frequencia','classe','categoria','erp','entidade','carater','finalidade','lat','lng'];
  const rows = [h.join(','), ...sel.map(s => h.map(k => { let v = String((s as Record<string,unknown>)[k] ?? ''); if (/[,"\n]/.test(v)) v = '"' + v.replace(/"/g,'""') + '"'; return v; }).join(','))];
  const blob = new Blob(['\uFEFF' + rows.join('\n')], { type: 'text/csv;charset=utf-8;' });
  const a = Object.assign(document.createElement('a'), { href: URL.createObjectURL(blob), download: 'HYPR_RadioMap_' + new Date().toISOString().slice(0,10) + '.csv' });
  document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(a.href);
}

export default function RadioMap() {
  const { isHypr, login } = useAuth();
  const [filtered, setFiltered] = useState<RadioStation[]>(allStations);
  const [cart, setCart] = useState<Set<number>>(new Set());
  const [activeIdx, setActiveIdx] = useState<number | null>(null);
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const mapRef = useRef<MLMap | null>(null);
  const popupRef = useRef<maplibregl.Popup | null>(null);

  const buildGeoJSON = useCallback((data: RadioStation[]) => ({
    type: 'FeatureCollection' as const,
    features: data.filter(s => s.lat != null && s.lng != null && s.lat !== 0).map((s, i) => ({
      type: 'Feature' as const, geometry: { type: 'Point' as const, coordinates: [s.lng, s.lat] },
      properties: { idx: i, tipo: s.tipo, _sid: s._sid },
    })),
  }), []);

  const onMapReady = useCallback((map: MLMap) => {
    mapRef.current = map;
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

  // Popup — original style with border separators
  const openPopup = useCallback((idx: number, coords: [number, number]) => {
    const s = filtered[idx]; if (!s || !mapRef.current) return;
    if (popupRef.current) popupRef.current.remove();
    const erp = getRadioERP(s.erp, s.classe);
    const r = Math.round(estimateRadioRadius(erp, s.tipo));
    const aud = estimateRadioAudience(s.erp, s.tipo, s.classe, s.uf);
    const c = s.tipo === 'FM' ? RADIO_COLORS.fm : RADIO_COLORS.am;
    const u = s.tipo === 'FM' ? 'MHz' : 'kHz';
    const row = (l: string, v: string) => `<div style="padding:8px 0;border-bottom:0.5px solid var(--border)"><div style="font-size:11px;letter-spacing:0.02em;color:var(--text-muted);margin-bottom:3px">${l}</div><div style="font-size:13px;font-weight:500;color:var(--text-primary)">${v}</div></div>`;
    const html = `<div style="font-family:Urbanist,sans-serif">
      <div style="height:2px;background:${c}"></div>
      <div style="padding:18px 20px 0">
        <div style="display:flex;align-items:baseline;gap:8px;margin-bottom:4px">
          <span style="font-weight:700;font-size:20px;color:${c}">${s.frequencia}</span>
          <span style="font-size:11px;color:var(--text-faint)">${u}</span>
          <span style="font-size:11px;color:var(--text-faint);margin-left:auto">${s._fantasy || s.tipo}</span>
        </div>
        <div style="font-size:13px;font-weight:600;color:var(--text-primary);margin-bottom:10px">${s.municipio} — ${s.uf}</div>
      </div>
      <div style="padding:0 20px">
        ${row('Entidade', s.entidade || '—')}
        <div style="display:grid;grid-template-columns:1fr 1fr">
          ${row('Classe', s.classe || '—')}${row('Categoria', s.categoria || '—')}
          ${row('ERP / Alcance', erp.toLocaleString('pt-BR') + ' W (~' + r + ' km)')}${row('Finalidade', s.finalidade || '—')}
          ${row('Caráter', s.carater || '—')}<div></div>
        </div>
      </div>
      ${aud > 0 ? `<div style="background:var(--bg-surface2);border-radius:10px;padding:16px;text-align:center;margin:10px 20px">
        <div style="font-size:11px;letter-spacing:0.02em;color:var(--text-muted)">Audiência estimada</div>
        <div style="font-weight:700;font-size:20px;color:var(--accent);margin-top:5px;letter-spacing:-0.01em">${formatAudience(aud)} devices</div>
      </div>` : ''}
      <div style="font-size:11px;color:var(--text-faint);text-align:center;margin:8px 20px 14px;opacity:0.5">Modelo HYPR: alcance × densidade × penetração × campanha 30d</div>
    </div>`;
    const popup = new maplibregl.Popup({ closeButton: true, closeOnClick: true, maxWidth: '340px', offset: 10 })
      .setLngLat(coords).setHTML(html).addTo(mapRef.current!);
    popupRef.current = popup;
    popup.on('close', () => { popupRef.current = null; });
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

  const toggleCart = useCallback((sid: number) => { setCart(p => { const n = new Set(p); n.has(sid) ? n.delete(sid) : n.add(sid); return n; }); }, []);
  const clearCart = useCallback(() => setCart(new Set()), []);
  const selectAll = useCallback(() => { setCart(p => { const n = new Set(p); filtered.forEach(s => n.add(s._sid)); return n; }); }, [filtered]);

  const summary = useMemo(() => {
    if (!cart.size) return null;
    const sel = [...cart].map(sid => allStations.find(s => s._sid === sid)).filter(Boolean) as RadioStation[];
    const a = sel.reduce((s, e) => s + estimateRadioAudience(e.erp, e.tipo, e.classe, e.uf), 0);
    const u = [...new Set(sel.map(e => e.uf))];
    return <span><strong className="text-[var(--text-primary)] font-semibold">{formatAudience(a)}</strong> devices · {u.length} UFs</span>;
  }, [cart]);

  const ckStations = useMemo(() => [...cart].map(sid => allStations.find(s => s._sid === sid)).filter(Boolean).map(s => ({
    tipo: s!.tipo, frequencia: s!.frequencia, municipio: s!.municipio, uf: s!.uf,
    audience: estimateRadioAudience(s!.erp, s!.tipo, s!.classe, s!.uf),
  })), [cart]);

  const fmN = useMemo(() => filtered.filter(s => s.tipo === 'FM').length, [filtered]);

  return (<>
    <div className="flex flex-1 h-full min-h-0 overflow-hidden">
      {/* Sidebar — 200px like original */}
      <aside aria-label="Filtros e estações"
        className="hidden md:flex w-[290px] flex-col bg-[var(--bg-surface)] border-r border-[var(--border)] shrink-0 overflow-hidden">
        <RadioFilters stations={allStations} onFilter={onFilter} />
        <StationList stations={filtered} cart={cart} activeIdx={activeIdx} onFocus={focusStation}
          onToggleCart={toggleCart} onClearCart={clearCart} onSelectAll={selectAll} totalCount={filtered.length} />
      </aside>

      <MapContainer onMapReady={onMapReady}>
        {/* Legend */}
        <div className="absolute bottom-3.5 right-3.5 z-10 rounded-[10px] border-[0.5px] px-4 py-3 pointer-events-none overlay-panel">
          <div className="text-[11px] font-medium tracking-[0.03em] text-[var(--text-muted)] mb-2.5">Legenda</div>
          <div className="flex items-center gap-2 text-[12px] text-[var(--text-primary)] mb-1.5">
            <span className="w-[7px] h-[7px] rounded-full" style={{ background: RADIO_COLORS.fm }} aria-hidden="true" /> FM — {fmN.toLocaleString('pt-BR')}
          </div>
          <div className="flex items-center gap-2 text-[12px] text-[var(--text-primary)]">
            <span className="w-[7px] h-[7px] rounded-full" style={{ background: RADIO_COLORS.am }} aria-hidden="true" /> AM/OM — {(filtered.length - fmN).toLocaleString('pt-BR')}
          </div>
          <div className="text-[11px] text-[var(--text-faint)] mt-2">Anatel/SRD · 2026</div>
        </div>

        {/* Mobile FAB */}
        <button onClick={() => setDrawerOpen(true)} aria-label="Filtros"
          className="md:hidden absolute top-3.5 left-3.5 z-10 w-10 h-10 rounded-[10px] flex items-center justify-center text-[var(--text-muted)] hover:text-[var(--accent)] cursor-pointer overlay-panel">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <line x1="4" y1="6" x2="20" y2="6"/><line x1="4" y1="12" x2="14" y2="12"/><line x1="4" y1="18" x2="18" y2="18"/></svg>
        </button>
      </MapContainer>
    </div>

    {/* Mobile drawer */}
    {drawerOpen && (<>
      <div className="fixed inset-0 z-[1500] bg-[var(--overlay)]" style={{ backdropFilter:'blur(2px)' }} onClick={() => setDrawerOpen(false)} />
      <div className="fixed bottom-0 left-0 right-0 z-[1600] bg-[var(--bg-surface)] rounded-t-2xl border-t border-[var(--border)] max-h-[85vh] flex flex-col animate-[slideUp_0.3s_cubic-bezier(0.32,0.72,0,1)]">
        <div className="w-9 h-1 bg-[var(--border)] rounded-full mx-auto mt-3" />
        <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--border)]">
          <span className="text-sm font-semibold text-[var(--text-primary)]">Filtros</span>
          <button onClick={() => setDrawerOpen(false)} className="w-7 h-7 rounded-full bg-[var(--bg-surface2)] text-[var(--text-muted)] flex items-center justify-center cursor-pointer">×</button>
        </div>
        <div className="overflow-y-auto flex-1">
          <RadioFilters stations={allStations} onFilter={onFilter} />
          <div className="p-4"><button onClick={() => setDrawerOpen(false)}
            className="w-full py-2.5 rounded-lg bg-[var(--accent)] text-[var(--on-accent)] font-heading font-bold text-sm cursor-pointer">Aplicar</button></div>
        </div>
      </div>
    </>)}

    <SelectionBar count={cart.size} summary={summary} onCheckout={isHypr ? () => setCheckoutOpen(true) : login} onDownload={isHypr ? () => downloadCSV(cart) : login} canDownload={isHypr} />
    <CheckoutModal open={checkoutOpen} onClose={() => setCheckoutOpen(false)} stations={ckStations} />
  </>);
}
