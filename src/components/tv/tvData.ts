// HYPR Station — TV Map Data (lazy-loaded)
// Source: Anatel/Mosaico · ~550 generators (TVD) + ~13.6k retransmitters (RTV/RTVD)
// Generators loaded eagerly from /assets/tv/stations.json
// Retransmitters loaded on-demand from /assets/tv/retransmitters.json

import { TV_NETWORK_NAMES } from '../../lib/constants';

export type TvStationType = 'TVD' | 'RTV' | 'RTVD';

export interface TvStation {
  _sid: number;
  tipo: TvStationType;
  municipio: string;
  uf: string;
  canal: string;
  canal_virtual: string;
  erp_kw: number;
  altura_antena: number;
  entidade: string;
  rede_id: string;
  nome_fantasia: string;
  status: string;
  lat: number;
  lng: number;
  _mun: string;
  _ent: string;
  _nome: string;
  _fantasy: string;
  _rede_label: string;
}

interface RawLookups {
  T: string[]; M: string[]; U: string[]; C: string[]; V: string[];
  E: string[]; R: string[]; F: string[]; S: string[];
}

interface RawData {
  _meta?: { generated: string; source: string; count: number };
  _L: RawLookups;
  _D: Array<Array<number | string>>;
}

export interface TvData {
  stations: TvStation[];
  allUFs: string[];
  allRedes: string[];
  allCanais: string[];
  allStatus: string[];
  retransmittersLoaded: boolean;
}

const FIELDS = [
  'tipo', 'municipio', 'uf', 'canal', 'canal_virtual',
  'erp_kw', 'altura_antena',
  'entidade', 'rede_id', 'nome_fantasia', 'status',
  'lat', 'lng',
] as const;

const LOOKUP_KEYS: Array<keyof RawLookups | null> = [
  'T', 'M', 'U', 'C', 'V',
  null, null,
  'E', 'R', 'F', 'S',
  null, null,
];

function normalize(s: string): string {
  return (s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

function buildStations(raw: RawData, offset = 0): TvStation[] {
  return raw._D.map((row, i) => {
    const s: Record<string, unknown> = {};
    FIELDS.forEach((f, fi) => {
      const lk = LOOKUP_KEYS[fi];
      s[f] = lk ? raw._L[lk][row[fi] as number] : row[fi];
    });
    const station = s as unknown as TvStation;
    station._sid = offset + i;
    station._mun = normalize(station.municipio);
    station._ent = normalize(station.entidade);
    station._fantasy = normalize(station.nome_fantasia);
    station._nome = station._ent + ' ' + station._fantasy;
    station._rede_label = TV_NETWORK_NAMES[station.rede_id] || 'Outras';
    return station;
  });
}

function uniqueSorted(values: string[]): string[] {
  return Array.from(new Set(values.filter(Boolean))).sort((a, b) => a.localeCompare(b, 'pt-BR'));
}

function buildIndices(stations: TvStation[]): Omit<TvData, 'stations' | 'retransmittersLoaded'> {
  return {
    allUFs: uniqueSorted(stations.map(s => s.uf)),
    allRedes: uniqueSorted(stations.map(s => s.rede_id)),
    allCanais: uniqueSorted(stations.map(s => s.canal)),
    allStatus: uniqueSorted(stations.map(s => s.status)),
  };
}

let cachedData: TvData | null = null;
let pendingLoad: Promise<TvData> | null = null;
let rtvMerged = false;
let pendingRtv: Promise<TvStation[]> | null = null;

export async function loadTvData(): Promise<TvData> {
  if (cachedData) return cachedData;
  if (pendingLoad) return pendingLoad;

  pendingLoad = (async () => {
    const res = await fetch('/assets/tv/stations.json');
    if (!res.ok) throw new Error(`Failed to load TV stations: ${res.status}`);
    const raw: RawData = await res.json();
    const stations = buildStations(raw);
    cachedData = {
      stations,
      ...buildIndices(stations),
      retransmittersLoaded: false,
    };
    return cachedData;
  })();

  return pendingLoad;
}

export async function loadRetransmitters(): Promise<TvStation[]> {
  if (!cachedData) throw new Error('loadTvData() must be called first');
  if (rtvMerged) return cachedData.stations.filter(s => s.tipo !== 'TVD');
  if (pendingRtv) return pendingRtv;

  pendingRtv = (async () => {
    const res = await fetch('/assets/tv/retransmitters.json');
    if (!res.ok) throw new Error(`Failed to load retransmitters: ${res.status}`);
    const raw: RawData = await res.json();
    const offset = cachedData!.stations.length;
    const rtvStations = buildStations(raw, offset);

    const merged = [...cachedData!.stations, ...rtvStations];
    cachedData = {
      ...cachedData!,
      stations: merged,
      ...buildIndices(merged),
      retransmittersLoaded: true,
    };
    rtvMerged = true;
    return rtvStations;
  })();

  return pendingRtv;
}

export function _resetTvCache() {
  cachedData = null;
  pendingLoad = null;
  pendingRtv = null;
  rtvMerged = false;
}
