import type { Map as MLMap } from 'maplibre-gl';
import { OPERADORA_COLORS } from '../../lib/constants';
import { estimateCellRadius } from '../../lib/audience';
import type { ERB } from './cellData';

const SOURCE_ID = 'coverage-circles';
const FILL_LAYER = 'coverage-circles-fill';
const LINE_LAYER = 'coverage-circles-line';

function erbToCircleCoords(e: ERB): number[][] | null {
  const radiusKm = estimateCellRadius(e.tech_principal, e.freq_mhz[0]);
  if (radiusKm <= 0 || radiusKm > 50) return null; // Skip unreasonable radii

  const steps = 48;
  const coords: number[][] = [];
  const lat = e.lat;
  const lng = e.lng;

  for (let i = 0; i <= steps; i++) {
    const angle = (i / steps) * 2 * Math.PI;
    const dx = radiusKm * Math.cos(angle);
    const dy = radiusKm * Math.sin(angle);
    const cLat = lat + (dy / 111.32);
    const cLng = lng + (dx / (111.32 * Math.cos(lat * Math.PI / 180)));
    coords.push([cLng, cLat]);
  }

  return coords;
}

export function addCoverageCircles(map: MLMap, erbs: ERB[]) {
  removeCoverageCircles(map);

  // Only draw for visible ERBs in the viewport
  const bounds = map.getBounds();
  const visible = erbs.filter(e =>
    e.lat >= bounds.getSouth() && e.lat <= bounds.getNorth() &&
    e.lng >= bounds.getWest() && e.lng <= bounds.getEast()
  );

  // Limit to prevent performance issues
  const maxCircles = 500;
  const subset = visible.length > maxCircles ? visible.slice(0, maxCircles) : visible;

  const features: GeoJSON.Feature[] = [];

  for (const e of subset) {
    const coords = erbToCircleCoords(e);
    if (!coords) continue;

    const color = OPERADORA_COLORS[e.prestadora_norm] || OPERADORA_COLORS['Outras'];

    features.push({
      type: 'Feature',
      geometry: { type: 'Polygon', coordinates: [coords] },
      properties: {
        color,
        op: e.prestadora_norm,
        tech: e.tech_principal,
      },
    });
  }

  if (features.length === 0) return;

  map.addSource(SOURCE_ID, {
    type: 'geojson',
    data: { type: 'FeatureCollection', features },
  });

  map.addLayer({
    id: FILL_LAYER,
    type: 'fill',
    source: SOURCE_ID,
    paint: {
      'fill-color': ['get', 'color'],
      'fill-opacity': 0.06,
    },
  });

  map.addLayer({
    id: LINE_LAYER,
    type: 'line',
    source: SOURCE_ID,
    paint: {
      'line-color': ['get', 'color'],
      'line-width': 0.8,
      'line-opacity': 0.25,
      'line-dasharray': [3, 3],
    },
  });
}

export function removeCoverageCircles(map: MLMap) {
  if (map.getLayer(LINE_LAYER)) map.removeLayer(LINE_LAYER);
  if (map.getLayer(FILL_LAYER)) map.removeLayer(FILL_LAYER);
  if (map.getSource(SOURCE_ID)) map.removeSource(SOURCE_ID);
}

export function updateCoverageCircles(map: MLMap, erbs: ERB[], enabled: boolean) {
  if (!enabled) {
    removeCoverageCircles(map);
    return;
  }

  const zoom = map.getZoom();
  if (zoom < 9) {
    removeCoverageCircles(map);
    return;
  }

  addCoverageCircles(map, erbs);
}
