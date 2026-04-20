// HYPR Station — Audience & Coverage Models (v2)
//
// Modelo baseado em hexágonos populacionais IBGE 2022 (H3 res 7).
// Todas as estimativas partem de dados reais de população e passam por um
// funil de conversão explícito: residentes → adultos → smartphones →
// devices com Ad-ID disponível → devices ativos em DSP nos últimos 30 dias.
//
// Diferença crítica em relação ao modelo v1: quando múltiplas ERBs (ou
// rádios) cobrem os mesmos hexágonos, a população dos hexágonos é contada
// UMA ÚNICA VEZ na união geográfica — elimina a dupla contagem que inflava
// a audiência em áreas densas (ex: SP capital retornava >300M devices).

import { latLngToCell, gridDisk, cellToChildren } from 'h3-js';
import { getPopulationMap, sumHexes, getPopulationResolution } from './populationData';

// =====================================================================
// 1. Fatores de conversão do funil
// =====================================================================

/**
 * Proporção da população residente com 18+ anos.
 * Fonte: IBGE Censo 2022 — 77.3% dos brasileiros têm 18+ anos.
 * Arredondamos para 0.77 (média nacional). Variação por UF é pequena.
 */
const ADULT_RATE = 0.77;

/**
 * Penetração de smartphone entre adultos, por UF.
 * Fonte: TIC Domicílios 2023 (CGI.br/NIC.br), tabela "Uso individual da
 * internet por UF > Dispositivo: telefone celular".
 *
 * Representa: % de adultos que USAM smartphone. Difere do "% de domicílios
 * com smartphone" (que é mais alto). Valores conservadores.
 */
const SMARTPHONE_PEN_BY_UF: Record<string, number> = {
  SP: 0.91, DF: 0.93, RJ: 0.90, SC: 0.90, PR: 0.89, RS: 0.89,
  MG: 0.87, ES: 0.88, GO: 0.86, MS: 0.85, MT: 0.84,
  BA: 0.83, PE: 0.84, CE: 0.82, PB: 0.81, RN: 0.82, SE: 0.81, AL: 0.80,
  MA: 0.75, PI: 0.76, TO: 0.77,
  AM: 0.78, PA: 0.76, AP: 0.78, AC: 0.75, RR: 0.77, RO: 0.79,
};
const SMARTPHONE_PEN_DEFAULT = 0.83;

/**
 * Proporção de smartphones com Ad-ID endereçável (IDFA iOS / GAID Android
 * não-zerado e não opt-out).
 *
 * Mix Brasil ≈ 45% iOS, 55% Android (StatCounter 2025).
 * Opt-in IDFA iOS: ~30% (IAB/Liftoff 2024).
 * Non-opt-out GAID Android: ~75% (consistente com DV360/Xandr Brasil).
 *
 * Ponderado: 0.45 × 0.30 + 0.55 × 0.75 = 0.55
 */
const MAID_AVAILABLE_RATE = 0.55;

/**
 * Proporção de MAIDs endereçáveis que aparecem em pelo menos uma bid
 * request num DSP em janela de 30 dias.
 *
 * Ajuste pra remover devices raramente online (SIM-only, legacy, dispositivos
 * secundários) e pra aproximar "reach real" do que o DSP entrega em campanha.
 *
 * Valor baseado em overlap de MAU GA4 Brasil × bid-stream DV360/Xandr.
 */
const MAU_DSP_30D = 0.70;

/**
 * Fator composto adulto → endereçável, por UF. Pré-calculado no load.
 * endereçável = pop × ADULT_RATE × SMARTPHONE_PEN[uf] × MAID × MAU_DSP
 */
function addressableFactor(uf: string): number {
  const pen = SMARTPHONE_PEN_BY_UF[uf] ?? SMARTPHONE_PEN_DEFAULT;
  return ADULT_RATE * pen * MAID_AVAILABLE_RATE * MAU_DSP_30D;
}

function smartphoneFactor(uf: string): number {
  const pen = SMARTPHONE_PEN_BY_UF[uf] ?? SMARTPHONE_PEN_DEFAULT;
  return ADULT_RATE * pen;
}

// =====================================================================
// 2. Raios efetivos de cobertura (ERB celular + rádio)
// =====================================================================

/**
 * Raio teórico máximo por tecnologia × faixa de frequência (km).
 * Usado como input antes do cap por densidade urbana.
 */
const CELL_RADIUS: Record<string, Record<string, number>> = {
  '5G': { '3500': 0.5, '2600': 0.8, '2100': 1.0, '700': 3.0, default: 0.8 },
  '4G': { '700': 15, '1800': 5, '2100': 4, '2600': 3, default: 5 },
  '3G': { '850': 12, '900': 10, '2100': 5, default: 8 },
  '2G': { '850': 35, '900': 30, '1800': 15, default: 25 },
};

export function estimateCellRadius(tech: string, freqMhz?: number): number {
  const techMap = CELL_RADIUS[tech] || CELL_RADIUS['4G'];
  if (freqMhz) {
    const key = String(freqMhz);
    if (techMap[key]) return techMap[key];
    const freqs = Object.keys(techMap).filter(k => k !== 'default').map(Number);
    const closest = freqs.reduce((a, b) => Math.abs(b - freqMhz) < Math.abs(a - freqMhz) ? b : a);
    return techMap[String(closest)] || techMap.default;
  }
  return techMap.default;
}

// =====================================================================
// 3. Rádio — ERP → raio estimado
// =====================================================================

const ERP_FALLBACK: Record<string, number> = {
  A: 100, A1: 30, A2: 19, A3: 14, A4: 5,
  B: 50, B1: 3, B2: 1, C: 1,
  E1: 48, E2: 65, E3: 38,
};

export function getRadioERP(erp: number, classe: string): number {
  return erp > 0 ? erp : (ERP_FALLBACK[classe] || 5);
}

export function estimateRadioRadius(erp: number, tipo: string): number {
  if (erp <= 0) return 0;
  const base = tipo === 'FM' ? 4.0 : 6.0;
  return base * Math.sqrt(erp);
}

// =====================================================================
// 4. ERB/rádio → conjunto de hexes H3 cobertos
// =====================================================================

/**
 * Aresta média de um hexágono H3 por resolução (km, aproximado).
 * Fonte: documentação H3 — https://h3geo.org/docs/core-library/restable/
 * Usado para converter raio em km → número de anéis H3 (gridDisk k).
 */
const H3_EDGE_KM: Record<number, number> = {
  5: 8.544,
  6: 3.229,
  7: 1.220,
  8: 0.461,
};

/**
 * Converte raio em km em número de anéis H3 (parâmetro k de gridDisk) na
 * resolução do dataset populacional. Garante cobertura mínima: mesmo raios
 * <1 km retornam ao menos o hex central.
 */
function radiusToRings(radiusKm: number, resolution: number): number {
  const edge = H3_EDGE_KM[resolution] ?? 1.22;
  // Um "anel" adiciona ~2 * edge ao raio coberto (centro→próximo centro).
  return Math.max(0, Math.ceil(radiusKm / (2 * edge)));
}

/**
 * Conjunto de hexes H3 (res 7) cobertos por uma ERB celular.
 * Usa raio teórico pelo par (tech, freq) e desenha um disco H3 a partir
 * do centróide da ERB.
 *
 * Nota: é uma aproximação discreta da área circular. Para raios pequenos
 * (5G <1 km), retorna apenas 1 hex (o central).
 */
export function hexesForCellERB(
  lat: number, lng: number, tech: string, freqMhz?: number
): string[] {
  if (!lat || !lng) return [];
  const radius = estimateCellRadius(tech, freqMhz);
  const res = getPopulationResolution();
  const center = latLngToCell(lat, lng, res);
  const k = radiusToRings(radius, res);
  return gridDisk(center, k);
}

/**
 * Conjunto de hexes H3 (res 7) cobertos por uma estação de rádio.
 * Raio derivado de ERP via estimateRadioRadius.
 */
export function hexesForRadio(
  lat: number, lng: number, erp: number, tipo: string, classe: string
): string[] {
  if (!lat || !lng) return [];
  const effectiveErp = getRadioERP(erp, classe);
  const radius = estimateRadioRadius(effectiveErp, tipo);
  if (radius <= 0) return [];
  const res = getPopulationResolution();
  const center = latLngToCell(lat, lng, res);
  const k = radiusToRings(radius, res);
  return gridDisk(center, k);
}

/**
 * Converte um hex H3 de resolução arbitrária (ex: r4/r5 da camada de
 * dominância) em seus descendentes na resolução do dataset populacional.
 * Para hex r4 → ~343 hexes r7, r5 → ~49 hexes r7.
 */
export function hexToPopulationChildren(hex: string, sourceRes: number): string[] {
  const targetRes = getPopulationResolution();
  if (sourceRes === targetRes) return [hex];
  if (sourceRes > targetRes) {
    throw new Error(`hexToPopulationChildren: ${sourceRes} > ${targetRes}`);
  }
  return cellToChildren(hex, targetRes);
}

// =====================================================================
// 5. Funil de audiência sobre um conjunto de hexes
// =====================================================================

export interface AudienceBreakdown {
  /** População residente (IBGE Censo 2022). */
  population: number;
  /** Adultos 18+ anos. */
  adults: number;
  /** Adultos que usam smartphone (TIC Domicílios 2023 por UF). */
  smartphones: number;
  /** Smartphones com Ad-ID endereçável × ativos em DSP 30d. */
  addressable: number;
  /** Quantos hexes únicos foram considerados. */
  hexCount: number;
  /** População por UF — útil pra exibir distribuição geográfica. */
  ufBreakdown: Record<string, number>;
  /** Endereçáveis por UF (pop_uf × factor_uf). */
  addressableByUf: Record<string, number>;
}

/**
 * Estima audiência a partir de uma coleção de hexes H3. Deduplicação é
 * automática — passe um Set ou um array (o cálculo usa a união).
 *
 * Se o dataset populacional ainda não foi carregado, retorna zeros em
 * vez de crashar. Chame preloadPopulation() na inicialização.
 */
export function estimateAudienceFromHexes(
  hexes: Iterable<string> | string[] | Set<string>
): AudienceBreakdown {
  const map = getPopulationMap();
  const uniqueHexes = hexes instanceof Set ? hexes : new Set(hexes);

  if (!map) {
    return emptyBreakdown(uniqueHexes.size);
  }

  const { pop, ufBreakdown } = sumHexes(uniqueHexes);
  if (pop === 0) return emptyBreakdown(uniqueHexes.size);

  let adults = 0;
  let smartphones = 0;
  let addressable = 0;
  const addressableByUf: Record<string, number> = {};

  for (const [uf, ufPop] of Object.entries(ufBreakdown)) {
    const ufAdults = ufPop * ADULT_RATE;
    const ufSmartphones = ufPop * smartphoneFactor(uf);
    const ufAddressable = ufPop * addressableFactor(uf);
    adults += ufAdults;
    smartphones += ufSmartphones;
    addressable += ufAddressable;
    addressableByUf[uf] = Math.round(ufAddressable);
  }

  return {
    population: pop,
    adults: Math.round(adults),
    smartphones: Math.round(smartphones),
    addressable: Math.round(addressable),
    hexCount: uniqueHexes.size,
    ufBreakdown,
    addressableByUf,
  };
}

function emptyBreakdown(hexCount: number): AudienceBreakdown {
  return {
    population: 0, adults: 0, smartphones: 0, addressable: 0,
    hexCount, ufBreakdown: {}, addressableByUf: {},
  };
}

// =====================================================================
// 6. Helpers de alto nível — seleções de ERBs/rádios
// =====================================================================

export interface ERBLike {
  lat: number;
  lng: number;
  tech_principal: string;
  freq_mhz?: number[] | null;
}

export interface RadioLike {
  lat: number;
  lng: number;
  erp: number;
  tipo: string;
  classe: string;
}

/**
 * Estima audiência de uma única ERB (popup individual).
 */
export function estimateSingleERB(erb: ERBLike): AudienceBreakdown {
  const hexes = hexesForCellERB(erb.lat, erb.lng, erb.tech_principal, erb.freq_mhz?.[0]);
  return estimateAudienceFromHexes(hexes);
}

/**
 * Estima audiência da UNIÃO de múltiplas ERBs. Dedupe de sobreposição é
 * automática — este é o cálculo correto pro plano/carrinho.
 */
export function estimateERBSelection(erbs: ERBLike[]): AudienceBreakdown {
  const union = new Set<string>();
  for (const e of erbs) {
    if (!e.lat || !e.lng) continue;
    const hexes = hexesForCellERB(e.lat, e.lng, e.tech_principal, e.freq_mhz?.[0]);
    for (const h of hexes) union.add(h);
  }
  return estimateAudienceFromHexes(union);
}

/**
 * Estima audiência de uma única estação de rádio (popup individual).
 */
export function estimateSingleRadio(station: RadioLike): AudienceBreakdown {
  const hexes = hexesForRadio(
    station.lat, station.lng, station.erp, station.tipo, station.classe
  );
  return estimateAudienceFromHexes(hexes);
}

/**
 * Estima audiência da UNIÃO de múltiplas rádios.
 */
export function estimateRadioSelection(stations: RadioLike[]): AudienceBreakdown {
  const union = new Set<string>();
  for (const s of stations) {
    if (!s.lat || !s.lng) continue;
    const hexes = hexesForRadio(s.lat, s.lng, s.erp, s.tipo, s.classe);
    for (const h of hexes) union.add(h);
  }
  return estimateAudienceFromHexes(union);
}

// =====================================================================
// 7. Formatação
// =====================================================================

export function formatAudience(n: number): string {
  if (!Number.isFinite(n) || n <= 0) return '0';
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M';
  if (n >= 1_000) return (n / 1_000).toFixed(1) + 'K';
  return Math.round(n).toString();
}
