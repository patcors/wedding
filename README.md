# Patrick & Amelia — Jasper's Berry

A single-page Astro + Tailwind site for our wedding. Hosted on GitHub Pages,
with an RSVP form that posts to a Google Apps Script Web App which appends each
reply to a Google Sheet.

## Local development

```sh
pnpm install
cp .env.example .env       # paste your Apps Script URL in here
pnpm dev                   # http://localhost:4321
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

## Stack

- **Astro 6** — static output, zero-JS by default
- **Tailwind v4** — via `@tailwindcss/vite`, theme tokens declared in
  `src/styles/global.css` (`@theme { … }`)
- **Fonts** — Fraunces (display), Cormorant Garamond (body), DM Mono (accents)
- One JS island for the RSVP form submit handler. Everything else ships as HTML.
