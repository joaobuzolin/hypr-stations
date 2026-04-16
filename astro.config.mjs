// @ts-check
import { defineConfig } from 'astro/config';
import react from '@astrojs/react';
import tailwindcss from '@tailwindcss/vite';

// https://astro.build/config
export default defineConfig({
  integrations: [react()],
  vite: {
    plugins: [tailwindcss()],
    build: {
      rollupOptions: {
        output: {
          manualChunks(id) {
            // MapLibre GL + its deps get their own chunk (cacheable independently)
            if (id.includes('maplibre-gl') || id.includes('pbf') || id.includes('earcut') ||
                id.includes('geojson-vt') || id.includes('kdbush') || id.includes('gl-matrix') ||
                id.includes('tiny-sdf') || id.includes('murmurhash') || id.includes('potpack') ||
                id.includes('@mapbox')) {
              return 'maplibre';
            }
          },
        },
      },
    },
  },
  output: 'static',
});