# HYPR Station

Plataforma de mapas de cobertura de mídia — rádio, celular e TV.

**URL:** `stations.hypr.mobi`

## Stack

- **Astro 6** — meta-framework, static pages + selective hydration
- **React 19** — interactive islands (maps, filters, checkout)
- **Tailwind CSS v4** — styling com design tokens HYPR
- **MapLibre GL JS** — renderização de mapas
- **Supabase** — dados ERBs (Cell Map)
- **Vercel** — deploy, domínio, preview branches

## Estrutura

```
src/
├── layouts/         Astro layouts (BaseLayout)
├── pages/           Rotas (index, radio, cell)
├── components/
│   ├── shared/      Header, ThemeToggle, Auth, Checkout, MultiSelect,
│   │                ToggleGroup, SelectionBar, MapContainer, LoginButton
│   ├── hub/         MapCard, HubSearch, HubStats
│   ├── radio/       RadioMap, RadioFilters, StationList, radioData
│   └── cell/        CellMap, CellFilters, CellStationList, ViewModeSelector,
│                    DominancePanel, analysisLayers, coverageLayer, cellData
├── lib/             Supabase client, constants, audience helpers
└── styles/          global.css (Tailwind + design tokens V3)
```

## Design System V3

Paleta dark-first com cores dessaturadas. Escala tipográfica em 4 tamanhos primários (11/13/15/20px). Border-radius em 5 níveis (5-6/8/10/12/14px). Animações de entrada (fadeUp, slideIn, barIn, dotPulse).

Tokens definidos em `src/styles/global.css` via `@theme`. Cores de operadora e tecnologia em `src/lib/constants.ts`.

## Dev

```bash
npm install
npm run dev        # localhost:4321
npm run build      # static output → dist/
npm run preview    # preview build
```

## Deploy

Push para `main` → Vercel auto-deploy em `stations.hypr.mobi`.
