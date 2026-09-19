# Patrick & Amelia — Jasper's Berry

A single-page Astro + Tailwind site for our wedding. Hosted on GitHub Pages,
with an RSVP form that posts to a Google Apps Script Web App which appends each
reply to a Google Sheet.

## Prerequisites

- **Node.js** ≥ 22.12.0
- **pnpm** — install with `npm install -g pnpm` if you don't have it

## Local development

```sh
pnpm install
cp .env.example .env       # paste your Apps Script URL in here
pnpm dev                   # http://localhost:4321
```

## Build & preview

```sh
pnpm build      # outputs to dist/
pnpm preview    # serves dist/ locally to verify the production build
```

Edit the wedding details at the top of `src/pages/index.astro` (names, date,
schedule, venue copy). The colour palette and type stack live in
`src/styles/global.css` under `@theme`.

## RSVP backend — Google Apps Script

1. Create a Google Sheet. Name a tab `RSVPs`.
2. **Extensions → Apps Script**, replace the contents with:

   ```js
   const SHEET_NAME = 'RSVPs';

   function doPost(e) {
     const lock = LockService.getScriptLock();
     lock.waitLock(20000);
     try {
       const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_NAME);
       const headers = [
         'submitted_at', 'name', 'email', 'attending',
         'guest_count', 'dietary', 'song', 'message',
       ];
       if (sheet.getLastRow() === 0) sheet.appendRow(headers);
       const p = e.parameter || {};
       sheet.appendRow(headers.map((h) => p[h] || ''));
       return ContentService
         .createTextOutput(JSON.stringify({ ok: true }))
         .setMimeType(ContentService.MimeType.JSON);
     } finally {
       lock.releaseLock();
     }
   }
   ```

3. **Deploy → New deployment → Web app**:
   - Execute as: *Me*
   - Who has access: *Anyone*
4. Copy the deployment URL (looks like `https://script.google.com/macros/s/AKfycb.../exec`).
5. Put it in `.env` as `PUBLIC_RSVP_ENDPOINT=…` and, for production, add it
   under the repo's **Settings → Secrets and variables → Actions** with the
   same name.

The browser submits with `mode: "no-cors"`, so the script's response isn't read
— the form treats fetch resolution as success and shows the thank-you message.
Every redeploy of the Apps Script generates a **new URL** unless you choose
"Manage deployments → edit → Version: New version" on the existing deployment.

## GitHub Pages deployment

1. Push this repo to GitHub.
2. **Settings → Pages → Build and deployment → Source: GitHub Actions**.
3. Add the `PUBLIC_RSVP_ENDPOINT` repo secret (above).
4. Open `astro.config.mjs` and set `site` (and `base` if this is a project page
   rather than a `<user>.github.io` root repo):

   ```js
   site: 'https://<your-user>.github.io',
   base: '/<repo-name>/',  // omit/comment out for root site
   ```

5. Push to `main`. The workflow at `.github/workflows/deploy.yml` builds with
   `withastro/action` and publishes `dist/`.

### Custom domain

Add a file `public/CNAME` containing your domain (one line). Then point the
DNS at GitHub Pages per their docs.

## The scroll experience

`/story` (preview) and `/story/<slug>` (per-guest) render the scroll experience:
two strands — a sailor's rope and a circus silk — weaving through suspended
photographs, braiding at the point the two lives met.

- **What to build next, in order:** [docs/ASSET_TASKS.md](docs/ASSET_TASKS.md)
- **Jargon:** [docs/GLOSSARY.md](docs/GLOSSARY.md)
- **Authoring content:** edit the arrays in `src/components/story/billboards.ts`
- **Iterating:** the debug scrubber at the bottom of the page is far faster than
  scrolling. Remove it before launch.

Currently running on grey-box placeholders generated at runtime — no asset files
required to develop against it.

## Garden loading and mobile performance

`/garden` serves its monogram loader in the initial HTML. It starts the garden
textures, prebuilt tree models, photos and local Latin fonts before reveal. The
3D canvas is a separate JavaScript chunk. Readiness requires decoded photos,
loaded fonts, shader compilation, warm-up renders along the camera route and
two clean opening frames. Hidden boat prototypes retain the programs and shared
geometry for all three boat types and the rubber duck, so the first launch can
reuse them. Every third launch (from the button or water) is a duck; other
launches keep the random boat selection. The count resets on a fresh page load.

The four active floaters share a lightweight planar physics simulation in
`boatPhysics.ts`. Convex hull contacts transfer momentum and spin, with gentle
restitution, contact friction, and water drag. Hull size and mass differ by type,
so the small duck moves more when bumped by a tug. Curved banks constrain the
whole rotating hull, and wakes retain actual emission positions after a collision.
Fixed 120 Hz substeps make motion consistent across frame rates; pause and reduced
motion freeze the simulation. Run `node --test tests/boatPhysics.test.mjs` to check
impacts, overlapping launches, river containment, timing, wakes, and retirement.

Mobile devices start at 1× pixel density with 256px water reflections, 512px
shadows, fewer distant trees and bank details, and a simpler terrain mesh. Water
reflections update at most 30 times per second while the camera is stationary;
mobile shadows update at most 10 times per second. Sustained slow frames lower
pixel density to .85× and reduce bank detail further. Quality selection is
separate from the portrait/landscape composition control. Scrolling updates the
camera through a ref; React updates when the chapter or photograph changes.

The loader respects reduced motion and has no artificial minimum duration. A
failed asset or WebGL context offers the invitation and a retry; startup times
out after 25 seconds of foreground time. Background tabs pause rendering and
the loading deadline. The invitation also remains available without JavaScript.

Run `pnpm optimize:garden-assets` after changing the original photos, textures or
tree models. This regenerates the content-hashed derivatives in
`public/garden-assets/` and their checked-in manifest. Originals and attribution
remain in `public/photos`, `public/textures/garden` and `public/models/garden`.
Run it after `pnpm generate:garden-trees` when reauthoring trees. The manifest
respects Astro's configured base path; cache lifetime remains host-controlled.

Run `pnpm exec playwright install chromium` once, then `pnpm test:garden` for
the production-build browser checks. Existing geometry checks run with
`node --test tests/*.test.mjs`. Performance marks `garden-start`,
`garden-media-ready`, `garden-shaders-ready`, `garden-gpu-prepared` and
`garden-ready` separate startup stages in browser traces; `garden-preparation`
measures the whole preparation. Desktop browser emulation verifies behaviour,
not actual iPhone/Android GPU speed: check the opening, fast photo navigation,
first boat launch and a sustained scroll session on phones before release.

## Stack

- **Astro 7** — static output, zero-JS by default
- **Tailwind v4** — via `@tailwindcss/vite`, theme tokens declared in
  `src/styles/global.css` (`@theme { … }`)
- **Fonts** — Fraunces (display), Cormorant Garamond (body), DM Mono (accents)
- One JS island for the RSVP form submit handler. Everything else ships as HTML.
