// HYPR Station — Audience & Coverage Models
// Shared between Radio Map and Cell Map

import { getMunDensity } from './munDensity';

// Population density by UF (habitants/km²). Fallback for when we can't
// resolve municipal-level density (e.g. ERB has no municipio mapped, or
// the municipio name doesn't match the IBGE dataset). Source: IBGE 2022
// state averages.
const UF_DENSITY: Record<string, number> = {
  AC: 6.0,  AL: 112.6, AM: 2.6,   AP: 5.4,   BA: 25.3,  CE: 59.2,
  DF: 517.8, ES: 83.6, GO: 20.5,  MA: 20.3,  MG: 34.0,  MS: 7.9,
  MT: 4.1,   PA: 6.3,  PB: 69.8,  PE: 91.0,  PI: 12.2,  PR: 55.2,
  RJ: 367.3, RN: 62.6, RO: 6.7,   RR: 2.9,   RS: 40.3,  SC: 82.8,
  SE: 99.2,  SP: 185.1, TO: 5.7,
};


const ERP_FALLBACK: Record<string, number> = {
  A: 100, A1: 30, A2: 19, A3: 14, A4: 5,
  B: 50, B1: 3, B2: 1, C: 1,
  E1: 48, E2: 65, E3: 38,
};

const CLASS_MULTIPLIER: Record<string, number> = {
  A: 1.8, A1: 1.5, A2: 1.3, A3: 1.1, A4: 0.9,
  B: 1.6, B1: 0.7, B2: 0.5, C: 0.4,
  E1: 1.2, E2: 1.3, E3: 1.0,
};

export function getRadioERP(erp: number, classe: string): number {
  return erp > 0 ? erp : (ERP_FALLBACK[classe] || 5);
}

export function estimateRadioRadius(erp: number, tipo: string): number {
  if (erp <= 0) return 0;
  const base = tipo === 'FM' ? 4.0 : 6.0;
  return base * Math.sqrt(erp);
}

export function estimateRadioAudience(
  erp: number, tipo: string, classe: string, uf: string
): number {
  const effectiveErp = getRadioERP(erp, classe);
  const rKm = estimateRadioRadius(effectiveErp, tipo);
  if (rKm <= 0) return 0;
  const area = Math.PI * rKm * rKm;
  const baseDensity = UF_DENSITY[uf] || 30;
  const density = baseDensity * (CLASS_MULTIPLIER[classe] || 1);
  const pen = tipo === 'FM' ? 0.40 : 0.20;
  const campMult = 1.5;
  return Math.round(area * density * pen * campMult);
}


// Estimated radius (km) by technology + frequency band
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
    // Find closest
    const freqs = Object.keys(techMap).filter(k => k !== 'default').map(Number);
    const closest = freqs.reduce((a, b) => Math.abs(b - freqMhz) < Math.abs(a - freqMhz) ? b : a);
    return techMap[String(closest)] || techMap.default;
  }
  return techMap.default;
}

// Brazil's active mobile lines per habitant. Anatel reports ~240M active
// lines against an IBGE population of ~213M — ratio stays stable around
// 1.10-1.12. We use 1.05 to be conservative (some lines are M2M/dormant).
const MOBILE_PENETRATION = 1.05;

export interface CellAudienceContext {
  /** Municipio name as stored in the ERB record (e.g. "São Paulo"). Used to
   *  look up the IBGE 2022 population density for that specific municipio,
   *  which is far more accurate than the UF average. */
  mun?: string;
}

/**
 * Per-tech effective-radius caps by population-density tier. Rationale:
 *  - Urban density triggers cell-sharing: a 4G 700MHz antenna that could
 *    technically reach 15km in open terrain only serves a small fraction
 *    of that because neighboring ERBs handle the same ring.
 *  - Different techs age differently. 2G/3G were deployed in the era of
 *    large cells for wide coverage; 5G deployments assume dense small-cell
 *    architecture. The caps preserve the inherent ordering 5G < 4G < 3G < 2G
 *    even under heavy urban cell-sharing, so a 2G antenna in a capital still
 *    reads as "bigger reach" than a 5G antenna in the same area.
 *  - In genuinely rural zones (<50 hab/km²), there's no cell-sharing to
 *    bound the coverage — the theoretical max applies.
 *
 * Caps in km. Lookup: RADIUS_CAPS[tier][tech] → cap in km, or undefined if
 * the tier has no cap (rural).
 */
const RADIUS_CAPS: Array<{ minDensity: number; caps: Record<string, number> }> = [
  // Metrópoles (SP capital, Fortaleza, BH, Recife, Rio, Salvador core)
  { minDensity: 3000, caps: { '5G': 1.5, '4G': 2.5, '3G': 3.5, '2G': 4.0 } },
  // Capitais menores / zonas urbanas densas (POA, Curitiba, Goiânia)
  { minDensity: 1000, caps: { '5G': 2.0, '4G': 4.0, '3G': 6.0, '2G': 8.0 } },
  // Urbano médio / suburbano (Niterói, Campinas, Santos, Brasília Plano Piloto)
  { minDensity: 200,  caps: { '5G': 3.0, '4G': 7.0, '3G': 10.0, '2G': 15.0 } },
  // Interior / cidades médias (Cuiabá, Uberlândia, interior de SP não-capital)
  { minDensity: 50,   caps: { '5G': 5.0, '4G': 10.0, '3G': 15.0, '2G': 25.0 } },
  // Rural médio e deserto absoluto: sem cap, raio teórico aplica.
];

/**
 * Effective coverage radius — clamps the theoretical max from CELL_RADIUS
 * based on (density_tier, tech). Returns theoreticalKm unchanged when the
 * density is rural enough that the theoretical reach genuinely applies.
 */
export function effectiveRadius(tech: string, theoreticalKm: number, density: number): number {
  for (const tier of RADIUS_CAPS) {
    if (density >= tier.minDensity) {
      const cap = tier.caps[tech];
      if (cap == null) return theoreticalKm;
      return Math.min(theoreticalKm, cap);
    }
  }
  return theoreticalKm;
}

/**
 * Resolve density for a given (mun, uf) with graceful fallback chain:
 *   1. Municipal IBGE 2022 (requires preloadMunDensity() resolved)
 *   2. UF-level average (Censo 2022)
 *   3. Fixed floor of 30 hab/km²
 */
function resolveDensity(uf: string, mun?: string): number {
  let d: number | null = null;
  if (mun && uf) d = getMunDensity(mun, uf);
  if (d == null) d = UF_DENSITY[uf] ?? null;
  if (d == null) d = 30;
  return d;
}

/**
 * Estimate the population/devices within an ERB's effective coverage area.
 *
 * Formula:
 *   audience = π × r_effective² × density × MOBILE_PENETRATION
 *
 * Represents *all people in the coverage area with active mobile lines*,
 * not just devices of a specific operator. The driver is raw geographic
 * reach × local population density — two antennas of the same tech in the
 * same city return the same audience estimate, because the number reflects
 * "how many people this antenna's signal footprint touches", not "how many
 * of that operator's subscribers are under the antenna".
 *
 * Examples:
 *   5G 2100MHz em Recife (density 7255, r cap 1.5km):
 *     π × 1.5² × 7255 × 1.05 ≈ 53,832
 *   4G 1800MHz em Recife (density 7255, r cap 2.5km):
 *     π × 2.5² × 7255 × 1.05 ≈ 149,553
 *   4G 1800MHz em Passagem-PB (density 20, rural, r teórico 5km):
 *     π × 5² × 20 × 1.05 ≈ 1,648
 */
export function estimateCellAudience(
  tech: string,
  uf: string,
  freqMhz?: number,
  context?: CellAudienceContext
): number {
  const density = resolveDensity(uf, context?.mun);
  const rTheoretical = estimateCellRadius(tech, freqMhz);
  const rKm = effectiveRadius(tech, rTheoretical, density);
  const area = Math.PI * rKm * rKm;
  return Math.round(area * density * MOBILE_PENETRATION);
}

/**
 * Single-call helper returning everything the popup needs: effective
 * radius, audience estimate, and the density that drove the numbers.
 * Exposing `density` lets the UI add interpretive context like
 * "7.255 hab/km² (capital)" next to the raw audience number.
 */
export function estimateCellMetrics(
  tech: string,
  uf: string,
  freqMhz?: number,
  context?: CellAudienceContext
): { radius: number; audience: number; density: number; radiusTheoretical: number } {
  const density = resolveDensity(uf, context?.mun);
  const rTheoretical = estimateCellRadius(tech, freqMhz);
  const rKm = effectiveRadius(tech, rTheoretical, density);
  const area = Math.PI * rKm * rKm;
  const audience = Math.round(area * density * MOBILE_PENETRATION);
  return { radius: rKm, audience, density, radiusTheoretical: rTheoretical };
}

/**
 * Human-readable density label for the popup. Bucketing matches the
 * RADIUS_CAPS tiers so "metrópole" in the UI means "capped at metropolis
 * rates in the model" — keeps story/math in lock-step.
 */
export function densityLabel(density: number): string {
  if (density >= 3000) return 'metrópole';
  if (density >= 1000) return 'capital';
  if (density >= 200)  return 'urbano';
  if (density >= 50)   return 'interior';
  if (density >= 10)   return 'rural';
  return 'remoto';
}

export function formatAudience(n: number): string {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M';
  if (n >= 1_000) return (n / 1_000).toFixed(1) + 'K';
  return n.toString();
}
