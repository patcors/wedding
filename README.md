# Patrick & Amelia

The wedding website at [patrickandamelia.com](https://patrickandamelia.com). Astro 7 static site with a React Three Fiber garden, hosted on GitHub Pages. RSVPs post to a Google Apps Script web app that writes to a Google Sheet.

Vocabulary (Party, Guest, Invite code, Personal link, RSVP, Garden, Details page) is defined in [CONTEXT.md](CONTEXT.md). Decisions live in [docs/adr](docs/adr).

## Pages

| Path | What it is |
|---|---|
| `/` | The Garden, for anyone without a Personal link |
| `/<code>` | A Party's Personal link: the Garden, greeting them by name. It remembers the Party so the Details page can show their RSVP |
| `/details` | Location, times, getting there, where to stay, questions, and the RSVP |
| `/dev/links` | Dev only. Every Party's Personal link with a QR code, for making cards. Never built into the deployed site |

Parties live in `src/data/parties.ts`. Adding a Party there adds their page; the build fails if a code clashes with a page name.

## Local development

Requires Node ≥ 22.12 and pnpm.

```sh
pnpm install
cp .env.example .env         # paste the Apps Script URL (optional in dev)
pnpm dev                     # http://localhost:4321
node --test tests/*.test.mjs
pnpm build && pnpm preview   # check the production build
```

Dev-only tooling appears under `pnpm dev` and is stripped from the build: the Garden's Review panel (ground, rocks, plants and tree variants, butterfly colours, pause, scene only) and `/dev/links`. Gate anything new like it behind `import.meta.env.DEV`.

## Editing content

- Details page facts (schedule, venue, travel, where to stay, FAQs): the objects at the top of `src/pages/details.astro`. Wrap anything unconfirmed in `tbc()` and it shows a "to confirm" tag.
- Garden photos and captions: `memories` in `src/components/garden/Garden.tsx`.
- Link preview image: `public/og.jpg` (1200×630).

## RSVP backend

The Details page posts each RSVP to a Google Apps Script web app, which writes it to a Google Sheet.

1. Create a Google Sheet. The script creates the `RSVPs` and `Log` tabs and their header rows if they're missing.
2. **Extensions → Apps Script**, replace the contents with:

   ```js
   // RSVPs: one row per Guest, only the latest answer for each Invite code.
   // Log: every submission exactly as received, never edited.
   const RSVP_SHEET = 'RSVPs';
   const LOG_SHEET = 'Log';
   const RSVP_HEADERS = ['submitted_at', 'code', 'party', 'guest', 'attending', 'dietary', 'bus', 'contact', 'song', 'message'];
   const LOG_HEADERS = ['submitted_at', 'code', 'party', 'contact', 'song', 'message', 'guests'];

   function doPost(e) {
     const lock = LockService.getScriptLock();
     lock.waitLock(20000);
     try {
       const p = (e && e.parameter) || {};
       const code = String(p.code || '').trim();
       let guests = [];
       try { guests = JSON.parse(p.guests || '[]'); } catch (err) { guests = []; }

       const log = sheetWithHeaders(LOG_SHEET, LOG_HEADERS);
       appendText(log, [LOG_HEADERS.map((h) => p[h] || '')]);

       const rsvps = sheetWithHeaders(RSVP_SHEET, RSVP_HEADERS);
       // A Party's new reply replaces its old rows. Open RSVPs (no code) always append.
       if (code) deleteRowsWithCode(rsvps, code);
       appendText(rsvps, guests.map((g) => [
         p.submitted_at || '', code, p.party || '',
         g.name || '', g.attending || '', g.dietary || '', g.bus || '',
         p.contact || '', p.song || '', p.message || '',
       ]));

       return ContentService
         .createTextOutput(JSON.stringify({ ok: true }))
         .setMimeType(ContentService.MimeType.JSON);
     } finally {
       lock.releaseLock();
     }
   }

   function sheetWithHeaders(name, headers) {
     const book = SpreadsheetApp.getActiveSpreadsheet();
     const sheet = book.getSheetByName(name) || book.insertSheet(name);
     if (sheet.getLastRow() === 0) appendText(sheet, [headers]);
     return sheet;
   }

   // Writes as plain text so "0435 597 406" keeps its leading zero and
   // "+61…" or "=…" isn't read as a number or formula.
   function appendText(sheet, rows) {
     if (!rows.length) return;
     const range = sheet.getRange(sheet.getLastRow() + 1, 1, rows.length, rows[0].length);
     range.setNumberFormat('@');
     range.setValues(rows.map((row) => row.map(String)));
   }

   function deleteRowsWithCode(sheet, code) {
     const last = sheet.getLastRow();
     if (last < 2) return;
     const column = RSVP_HEADERS.indexOf('code') + 1;
     const codes = sheet.getRange(2, column, last - 1, 1).getValues();
     for (let i = codes.length - 1; i >= 0; i--) {
       if (String(codes[i][0]) === code) sheet.deleteRow(i + 2);
     }
   }
   ```

3. **Deploy → New deployment → Web app**:
   - Execute as: *Me*
   - Who has access: *Anyone*
4. Copy the deployment URL (looks like `https://script.google.com/macros/s/AKfycb.../exec`).
5. Put it in `.env` as `PUBLIC_RSVP_ENDPOINT=…` for local builds, and add it
   under the repo's **Settings → Secrets and variables → Actions** with the
   same name for production.
6. **Rebuild and redeploy the site** (push to `main`, or run the Deploy
   workflow by hand). The build bakes the URL in, so setting the secret alone
   changes nothing on the live site.

The form posts urlencoded fields (`submitted_at`, `code`, `party`, `contact`,
`song`, `message`, and `guests` as a JSON string of
`[{ name, attending, dietary, bus }]`) with `mode: "no-cors"`. The response is
opaque, so the page treats fetch resolving as success. With no endpoint set, a
dev server logs the payload to the console and shows the thank-you. A
production build shows the "email or text us" failure message.

Every new deployment of the Apps Script gets a **new URL**. To change the
script and keep the same URL, use "Manage deployments → edit → Version: New
version" on the existing deployment.

## Deployment

Every push to `main` builds and deploys through `.github/workflows/deploy.yml` (GitHub Pages, custom domain patrickandamelia.com). The `PUBLIC_RSVP_ENDPOINT` repo secret is read at build time, so after changing it, re-run the workflow or push again.

## Stack

- Astro 7, static output, `compressHTML: true` (keeps spaces in the "P & A" monogram)
- React 19 + React Three Fiber + drei for the Garden; butterflies are DOM/CSS
- Plain scoped CSS; Cormorant Garamond and Montserrat from Google Fonts
- Garden asset pipelines: `pnpm prepare:garden-ground`, `pnpm generate:garden-trees` (see docs/GARDEN_*.md)
