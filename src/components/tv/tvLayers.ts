// HYPR Station — TV Map Layers
// Marco 1: station pins only. Contornos + audience arrive in Marco 2+.

import type { Map as MLMap, GeoJSONSource } from 'maplibre-gl';
import { TV_NETWORK_COLORS, TV_TYPE_COLORS } from '../../lib/constants';
import type { TvStation } from './tvData';

export const TV_LAYERS = {
  stationsSource: 'tv-stations',
  clusters: 'tv-clusters',
  clusterCount: 'tv-cluster-count',
  pointsTvd: 'tv-points-tvd',
  pointsRtv: 'tv-points-rtv',
  pointsActive: 'tv-points-active',
} as const;

export function buildStationsGeoJSON(stations: TvStation[]): GeoJSON.FeatureCollection {
  return {
    type: 'FeatureCollection',
    features: stations
      .filter(s => s.lat != null && s.lng != null && s.lat !== 0 && s.lng !== 0)
      .map(s => ({
        type: 'Feature',
        geometry: { type: 'Point', coordinates: [s.lng, s.lat] },
        properties: {
          _sid: s._sid,
          tipo: s.tipo,
          rede_id: s.rede_id,
          color: TV_NETWORK_COLORS[s.rede_id] || TV_NETWORK_COLORS.outras,
        },
      })),
  };
}

export function installStationsLayer(map: MLMap, geojson: GeoJSON.FeatureCollection) {
  removeStationsLayer(map);

  map.addSource(TV_LAYERS.stationsSource, {
    type: 'geojson',
    data: geojson,
    cluster: true,
    clusterMaxZoom: 10,
    clusterRadius: 55,
  });

  map.addLayer({
    id: TV_LAYERS.clusters,
    type: 'circle',
    source: TV_LAYERS.stationsSource,
    filter: ['has', 'point_count'],
    paint: {
      'circle-color': TV_TYPE_COLORS.tvd,
      'circle-opacity': 0.3,
      'circle-radius': ['step', ['get', 'point_count'], 18, 50, 24, 200, 32, 1000, 42],
      'circle-stroke-width': 1.5,
      'circle-stroke-color': TV_TYPE_COLORS.tvd,
      'circle-stroke-opacity': 0.6,
    },
  });

  map.addLayer({
    id: TV_LAYERS.clusterCount,
    type: 'symbol',
    source: TV_LAYERS.stationsSource,
    filter: ['has', 'point_count'],
    layout: {
      'text-field': '{point_count_abbreviated}',
      'text-font': ['Noto Sans Regular'],
      'text-size': 12,
    },
    paint: {
      'text-color': 'rgba(255,255,255,0.92)',
    },
  });

  map.addLayer({
    id: TV_LAYERS.pointsRtv,
    type: 'circle',
    source: TV_LAYERS.stationsSource,
    filter: ['all', ['!', ['has', 'point_count']], ['!=', ['get', 'tipo'], 'TVD']],
    paint: {
      'circle-color': ['get', 'color'],
      'circle-opacity': 0.55,
      'circle-radius': ['interpolate', ['linear'], ['zoom'], 4, 2, 8, 3, 12, 4.5, 16, 6],
      'circle-stroke-width': 0.5,
      'circle-stroke-color': 'rgba(0,0,0,0.3)',
    },
  });

  map.addLayer({
    id: TV_LAYERS.pointsTvd,
    type: 'circle',
    source: TV_LAYERS.stationsSource,
    filter: ['all', ['!', ['has', 'point_count']], ['==', ['get', 'tipo'], 'TVD']],
    paint: {
      'circle-color': ['get', 'color'],
      'circle-opacity': 0.95,
      'circle-radius': ['interpolate', ['linear'], ['zoom'], 4, 4, 8, 6, 12, 8, 16, 11],
      'circle-stroke-width': 1.2,
      'circle-stroke-color': 'rgba(0,0,0,0.55)',
    },
  });

  map.addLayer({
    id: TV_LAYERS.pointsActive,
    type: 'circle',
    source: TV_LAYERS.stationsSource,
    filter: ['==', ['get', '_sid'], -1],
    paint: {
      'circle-color': ['get', 'color'],
      'circle-opacity': 1,
      'circle-radius': ['interpolate', ['linear'], ['zoom'], 4, 8, 8, 11, 12, 14, 16, 18],
      'circle-stroke-width': 2.5,
      'circle-stroke-color': '#fff',
    },
  });
}

export function updateStationsData(map: MLMap, geojson: GeoJSON.FeatureCollection) {
  const src = map.getSource(TV_LAYERS.stationsSource) as GeoJSONSource | undefined;
  if (src) src.setData(geojson);
}

export function highlightStation(map: MLMap, sid: number | null) {
  if (!map.getLayer(TV_LAYERS.pointsActive)) return;
  map.setFilter(TV_LAYERS.pointsActive, ['==', ['get', '_sid'], sid ?? -1]);
}

export function removeStationsLayer(map: MLMap) {
  [TV_LAYERS.pointsActive, TV_LAYERS.pointsTvd, TV_LAYERS.pointsRtv, TV_LAYERS.clusterCount, TV_LAYERS.clusters].forEach(id => {
    if (map.getLayer(id)) map.removeLayer(id);
  });
  if (map.getSource(TV_LAYERS.stationsSource)) map.removeSource(TV_LAYERS.stationsSource);
}
