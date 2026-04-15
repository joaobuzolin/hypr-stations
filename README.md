# HYPR Station

Plataforma de mapas de cobertura de mídia — rádio, celular e TV.

**URL:** `station.hypr.mobi`

## Stack

- **Astro 5** — meta-framework, static pages + selective hydration
- **React 19** — interactive islands (maps, filters, checkout)
- **Tailwind CSS v4** — styling com design tokens HYPR
- **MapLibre GL JS** — renderização de mapas
- **Supabase** — dados ERBs (Cell Map), auth, RLS
- **Vercel** — deploy, domínio, preview branches

## Estrutura

```
src/
├── layouts/         Astro layouts (BaseLayout)
├── pages/           Rotas (index, radio, cell)
├── components/
│   ├── shared/      Header, ThemeToggle, Auth, Checkout, MultiSelect
│   ├── hub/         MapCard (landing page)
│   ├── radio/       RadioMap island + filtros + dados
│   └── cell/        CellMap island + filtros + API
├── lib/             Supabase client, constants, helpers
└── styles/          Tailwind global + design tokens
```

## Dev

```bash
npm install
npm run dev        # localhost:4321
npm run build      # static output → dist/
npm run preview    # preview build
```

## Deploy

Push para `main` → Vercel auto-deploy em `station.hypr.mobi`.

## Roadmap

- [x] Fase 1 — Scaffold Astro + design tokens + hub
- [ ] Fase 2 — Shared components (Auth, Checkout)
- [ ] Fase 3 — Radio Map migration (React island)
- [ ] Fase 4 — Cell Map (ETL Anatel + Supabase + mapa)
- [ ] Fase 5 — Polish + launch
