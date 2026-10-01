// @ts-check
import { defineConfig } from 'astro/config';
import react from '@astrojs/react';

// https://astro.build/config
export default defineConfig({
  // Served from the custom domain on GitHub Pages, so there is no base path.
  // Link previews need this to build absolute image URLs.
  site: 'https://patrickandamelia.com',

  // Astro 7 defaults this to 'jsx', which strips whitespace between inline
  // elements (e.g. the "P & A" monogram). `true` keeps it.
  compressHTML: true,

  // Old addresses from before the Garden moved to the root.
  redirects: { '/garden': '/', '/info': '/details' },

  // The Garden has its own dev tooling, and the toolbar sat over the scene.
  devToolbar: { enabled: false },

  integrations: [react()],
});
