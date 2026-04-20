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

// Market share by operator (Anatel SMP 2024 Q4, approximate national average).
// Source: Anatel Painel de Dados do SMP. Used when no local share is passed
// in the context. Values sum to ~100% across all listed operators.
const OPERATOR_SHARE: Record<string, number> = {
  Vivo: 0.384,
  Claro: 0.330,
  TIM: 0.236,
  Algar: 0.008,
  Brisanet: 0.015,
  Sercomtel: 0.002,
  Unifique: 0.005,
  Outras: 0.020,
};

// Brazil's active mobile lines per habitant. Anatel reports ~240M active
// lines against an IBGE population of ~213M — ratio stays stable around
// 1.10-1.12. We use 1.05 to be conservative (some lines are M2M/dormant).
const MOBILE_PENETRATION = 1.05;

export interface CellAudienceContext {
  /** Municipio name as stored in the ERB record (e.g. "São Paulo"). Used to
   *  look up the IBGE 2022 population density for that specific municipio,
   *  which is far more accurate than the UF average. */
  mun?: string;
  /** Normalized operator name (e.g. "Vivo", "Claro", "TIM"). When provided,
   *  the result is scaled by that operator's national market share — so the
   *  return value represents devices that specific operator likely serves,
   *  not the total devices in the area. */
  operatorName?: string;
  /** Local market share override, computed from the hex dominance data when
   *  available. If passed, takes precedence over OPERATOR_SHARE national. */
  localShare?: number;
}

/**
 * Estimate the number of active mobile devices an ERB likely serves within
 * its theoretical coverage radius.
 *
 * Precision hierarchy for population density:
 *   1. Municipal (IBGE 2022, from mun-density.json) — requires context.mun
 *      and preloadMunDensity() to have resolved
 *   2. State average (UF_DENSITY) — fallback when municipal lookup misses
 *   3. Fixed floor (30) — last resort when neither is available
 *
 * Formula:
 *   devices = π × r² × density × mobilePenetration × operatorShare
 *
 * Example: ERB Vivo 5G 2600MHz in São Paulo capital
 *   r = 0.8 km → area ≈ 2.01 km²
 *   density = 7820 hab/km² (IBGE: pop 11.9M / area 1521 km²)
 *   devices = 2.01 × 7820 × 1.05 × 0.384 ≈ 6,340
 */
export function estimateCellAudience(
  tech: string,
  uf: string,
  freqMhz?: number,
  context?: CellAudienceContext
): number {
  const rKm = estimateCellRadius(tech, freqMhz);
  const area = Math.PI * rKm * rKm;

  // Resolve density with graceful fallback chain.
  let density: number | null = null;
  if (context?.mun && uf) {
    density = getMunDensity(context.mun, uf);
  }
  if (density == null) density = UF_DENSITY[uf] ?? null;
  if (density == null) density = 30; // absolute floor

  // Operator share: local if provided (e.g. from hex dominance), else national.
  const share = context?.localShare ??
    (context?.operatorName
      ? (OPERATOR_SHARE[context.operatorName] ?? 0.33)
      : 1);

  return Math.round(area * density * MOBILE_PENETRATION * share);
}


export function formatAudience(n: number): string {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M';
  if (n >= 1_000) return (n / 1_000).toFixed(1) + 'K';
  return n.toString();
}
