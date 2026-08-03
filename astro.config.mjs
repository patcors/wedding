// @ts-check
import { defineConfig } from 'astro/config';
import tailwindcss from '@tailwindcss/vite';
import react from '@astrojs/react';

// https://astro.build/config
export default defineConfig({
  // TODO: replace with your GitHub Pages URL.
  // For a project page: https://<user>.github.io  + base: '/<repo>/'
  // For a user/org root page (<user>.github.io repo): leave base undefined.
  site: 'https://example.github.io',
  // base: '/wedding/',

  // Astro 7 defaults this to 'jsx', which strips whitespace between inline
  // elements. Pinned to `true` to preserve the v6 rendering of the existing
  // invitation pages — safe to drop once you've eyeballed them.
  compressHTML: true,

  integrations: [react()],

  vite: {
    plugins: [tailwindcss()],
  },
});
