// ═══════════════════════════════════════════════════
// HYPR Station — Shared Constants
// ═══════════════════════════════════════════════════

// Map product definitions
export const MAPS = {
  radio: {
    id: 'radio',
    name: 'Radio Map',
    subtitle: 'FM & AM coverage',
    description: 'Mapa interativo com ~3.890 estações de rádio FM e AM licenciadas pela Anatel. Filtre por estado, cidade, classe e entidade.',
    icon: 'radio',
    href: '/radio',
    status: 'active' as const,
    accent: 'teal',
    stats: { stations: '3.890', types: 'FM & AM', source: 'Anatel/SRD' },
  },
  cell: {
    id: 'cell',
    name: 'Cell Map',
    subtitle: 'Mobile coverage (ERBs)',
    description: 'Mapa de Estações Rádio Base (ERBs) com cobertura 2G, 3G, 4G e 5G de todas as operadoras brasileiras.',
    icon: 'signal',
    href: '/cell',
    status: 'active' as const,
    accent: 'blue',
    stats: { stations: '110K+', types: '2G–5G', source: 'Anatel/SMP' },
  },
  tv: {
    id: 'tv',
    name: 'TV Map',
    subtitle: 'Broadcast coverage',
    description: 'Mapa de estações de TV aberta e transmissores digitais.',
    icon: 'tv',
    href: '/tv',
    status: 'planned' as const,
    accent: 'gold',
    stats: { stations: 'TBD', types: 'Digital', source: 'Anatel' },
  },
} as const;

export type MapId = keyof typeof MAPS;
export type MapStatus = 'active' | 'coming-soon' | 'planned';

// Operadora colors (V3 — desaturated, elegant)
export const OPERADORA_COLORS: Record<string, string> = {
  'Vivo': '#9b6fc0',
  'Claro': '#e07050',
  'TIM': '#5ba3e6',
  'Brisanet': '#3a9aab',
  'Algar': '#3aab8c',
  'Unifique': '#6aba6e',
  'Sercomtel': '#d4c74a',
  'Outras': '#7a6e64',
};

// Technology colors (V3 — softer)
export const TECH_COLORS: Record<string, string> = {
  '5G': '#e85454',
  '4G': '#4db8d4',
  '3G': '#d4c74a',
  '2G': '#576773',
};

// Radio Map colors (V3)
export const RADIO_COLORS = {
  fm: '#4db8d4',
  am: '#d4c74a',
  fmBg: 'rgba(77, 184, 212, 0.07)',
  amBg: 'rgba(212, 199, 74, 0.07)',
};

// Google OAuth
export const HYPR_CLIENT_ID = '453955675457-r1q0dtm4oqbevqajt67bn6m2edndutkb.apps.googleusercontent.com';
export const HYPR_DOMAIN = '@hypr.mobi';

// Map defaults
export const MAP_CENTER: [number, number] = [-50, -14.5];
export const MAP_ZOOM = 4.2;
export const MAP_TILES = {
  dark: 'https://tiles.openfreemap.org/styles/dark',
  light: 'https://tiles.openfreemap.org/styles/positron',
};

// Exec contacts for checkout
export const EXECS = [
  { name: 'Alexandra', phone: '5511987854935', img: 'exec-alexandra.webp' },
  { name: 'Camila Tenorio', phone: '5511968639702', img: 'exec-camila.webp' },
  { name: 'Danilo Pereira', phone: '5511993906969', img: 'exec-danilo.webp' },
  { name: 'Egle Stein', phone: '5511996788521', img: 'exec-egle.webp' },
  { name: 'Fabio Ferri', phone: '5511983771489', img: 'exec-fabio.webp' },
  { name: 'Giovanna Hoffmann', phone: '5511999622306', img: 'exec-giovanna.webp' },
  { name: 'Karol', phone: '5511983532518', img: 'exec-karol.webp' },
  { name: 'Larissa Reis', phone: '5511996144910', img: 'exec-larissa.webp' },
  { name: 'Marcelo Nogueira', phone: '5511999010280', img: 'exec-marcelo.webp' },
  { name: 'Maria Eduarda Bolzan', phone: '5511997601880', img: 'exec-maria.webp' },
  { name: 'Pablo', phone: '5511966090970', img: 'exec-pablo.webp' },
] as const;

// Google Sheets webhook (checkout leads)
export const SHEETS_WEBHOOK = 'https://script.google.com/macros/s/AKfycbzs18nfMV7gRNONPgzoQ7vTF_P4kKXWNM5V8BJijUx6Ao1Qx48xvONYUXhKTs944yXR/exec';
