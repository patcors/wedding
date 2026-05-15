// @ts-check
import { defineConfig } from 'astro/config';
import tailwindcss from '@tailwindcss/vite';

// https://astro.build/config
export default defineConfig({
  // TODO: replace with your GitHub Pages URL.
  // For a project page: https://<user>.github.io  + base: '/<repo>/'
  // For a user/org root page (<user>.github.io repo): leave base undefined.
  site: 'https://example.github.io',
  // base: '/wedding/',
  vite: {
    plugins: [tailwindcss()],
  },
});
