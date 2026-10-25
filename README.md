# Patrick & Amelia

The wedding website at [patrickandamelia.com](https://patrickandamelia.com). Astro 7 static site with a React Three Fiber garden, hosted on GitHub Pages. RSVPs post to a Google Apps Script web app that writes to a Google Sheet.

Vocabulary (Party, Guest, Invite code, Personal link, RSVP, Garden, Details page) is defined in [CONTEXT.md](CONTEXT.md). Decisions live in [docs/adr](docs/adr).

## Pages

| Path | What it is |
|---|---|
| `/` | The Garden, for anyone without a Personal link |
| `/<code>` | A Party's Personal link: the Garden, greeting them by name. It remembers the Party so the Details page can show their RSVP |
| `/details` | Location, times, getting there, where to stay, questions, and the RSVP. Without a remembered Party, the RSVP points visitors to their Personal link instead of showing a form |
| `/dev/links` | Dev only. Every Party's Personal link with a QR code, for making cards. Never built into the deployed site |
| `/dev/invite/<code>` | Dev only. A Party's invitation image, screenshotted by `pnpm invites`. Never built into the deployed site |

Parties live in `src/data/parties.ts`. Adding a Party there adds their page; the build fails if a code clashes with a page name.

## Local development

Requires Node ≥ 22.12 and pnpm.

```sh
pnpm install
cp .env.example .env         # paste the Apps Script URL (optional in dev)
pnpm dev                     # http://localhost:4321
node --test tests/*.test.mjs
pnpm shots                   # screenshots of every voyage stop (docs/VOYAGE.md, Tools)
pnpm build && pnpm preview   # check the production build
```

Dev-only tooling appears under `pnpm dev` and is stripped from the build: the Garden's Review panel (ground, rocks, plants and tree variants, butterfly colours, pause, scene only), its Float a boat and Release a butterfly buttons, `/dev/links` and `/dev/invite/<code>`. Gate anything new like it behind `import.meta.env.DEV`.

## Editing content

- Details page facts (schedule, venue, travel, where to stay, FAQs): the objects at the top of `src/pages/details.astro`. A phone number in an answer (`0435 597 406`) becomes a tap-to-call link (`withPhoneLinks` in `src/components/details/phone.ts`).
- The Garden's story: `MILESTONES` in `src/components/garden/journey.ts`, one per date, oldest first. `month` is `'YYYY-MM'` and shows as the running date; `description` is what screen readers hear there; `room` gives a milestone more or less scroll at its date (a third of a share by default) and `hold` how long its date holds; each year from 2018 gets the same scroll however its milestones fall. See [docs/VOYAGE.md](docs/VOYAGE.md); `node --test tests/*.test.mjs` checks the story still runs in order.
- Link preview image: `public/og.jpg` (1200×630).

## Invitations

Each Party gets an iMessage with a personalised image, a message and their Personal link. The image is `/dev/invite/<code>`, a 1080×1350 page greeting the Party by name; with `pnpm dev` running:

```sh
pnpm invites                              # every Party → invites/out/<code>.png (2160×2700)
pnpm invites curry racecar                 # just these codes
pnpm invites --no-photo                   # without the engagement photo
pnpm invites --style=vibes                # another look from STYLES in the page
pnpm invites --script='Imperial Script'   # another script font from SCRIPTS in the page
pnpm invites --crop=offset                # another crop from CROPS in the page
pnpm invites --out=/tmp/drafts            # somewhere other than invites/out
pnpm invites --scale=1                    # 1080×1350
pnpm invites --base=http://localhost:4334 # dev server on another port
```

It drives headless Chrome (set `CHROME=/path/to/chrome` if it isn't found) and waits for the fonts and photo before each screenshot. The words, styles (fonts, colours, sizes) and photo crops are at the top of `src/pages/dev/invite/[code].astro`, and `STYLE` picks the one that's rendered. Open the page in a browser to tweak it, with `?style=<name>`, `?script=<name>`, `?crop=<name>` or `?photo=none`. `invites/out/` is git-ignored.

### Sending by text from Messages

`scripts/send-invites.mjs` texts each Party from this Mac's Messages app: the message in `invites/message.txt` with their greeting and Personal link filled in, then their image `invites/out/<code>.png` as an attachment. On its own it only prints what it would send; nothing goes until you add `--send` and type `send` to confirm.

1. Copy `invites/contacts.example.csv` to `invites/contacts.csv` and add a `code,phone` row for every mobile. A Party with two phones gets two rows. Write numbers any Australian way (`0400 000 000`, `+61 400…`, `61400…`); numbers from overseas need their `+` code. `contacts.csv` is gitignored: **phone numbers must never be committed.**
2. Rewrite `invites/message.txt`. `{greeting}`, `{link}` and `{code}` are filled in for each Party; any other `{…}` stops the run. `--send` refuses while the `[DRAFT…]` line is still there.
3. Dry run, and read every message:

   ```sh
   node scripts/send-invites.mjs
   ```

   It stops on unknown codes or numbers that aren't mobiles, lists Parties with no number, and skips Parties with no image (`--no-image` sends the text alone).
4. Test on yourself: `--to` sends the chosen Parties' messages to your number instead of theirs, and isn't logged.

   ```sh
   node scripts/send-invites.mjs --only curry --to "0400 000 000" --send
   ```

5. Send: `node scripts/send-invites.mjs --send`. `--limit 5` sends the next five; `--only curry,bridge` picks Parties.

Each attempt is appended to `invites/sent.log` (gitignored). A re-run skips numbers already sent, and numbers where only the text went or Messages didn't answer, so nothing arrives twice. Failures are retried. `--resend` sends again regardless.

How it sends:

- Through `scripts/send-invite.applescript`, run by `osascript` with every value passed as an argument, so apostrophes and emoji in the message are safe.
- By iMessage. If iMessage refuses a number outright and Messages has an SMS account (Text Message Forwarding from your iPhone), it retries by SMS. `--service sms` forces SMS; `--no-fallback` turns the retry off.
- Images are first copied to `~/Pictures/Wedding invites` (`--stage-dir`), because Messages marks scripted attachments from other folders "Not Delivered". Delete that folder once everything has gone.
- 5 seconds between recipients (`--delay`).
- The first run asks for permission for your terminal to control Messages (System Settings → Privacy & Security → Automation).

"Sent" means Messages accepted it, not that it arrived. Afterwards, look in Messages for any red "Not Delivered", usually a number not on iMessage, and resend with `--only <code> --resend --service sms`.

## RSVP backend

The Details page posts each RSVP to a Google Apps Script web app, which writes it to a Google Sheet.

1. Create a Google Sheet. The script creates the `RSVPs` and `Log` tabs and their header rows if they're missing.
2. **Extensions → Apps Script**, replace the contents with:

   ```js
   // RSVPs: one row per Guest, only the latest answer for each Invite code.
   // Log: every submission exactly as received, never edited.
   // Every RSVP comes from a Personal link, so a post without a code is
   // logged but never reaches RSVPs. GET ?code=… reads a Party's reply back,
   // so the Details page can show it on any device.
   const RSVP_SHEET = 'RSVPs';
   const LOG_SHEET = 'Log';
   // New columns go on the end, so rows already in the sheet keep theirs.
   // `contact` is the Guest's mobile, given only when they take the bus.
   const RSVP_HEADERS = ['submitted_at', 'code', 'party', 'guest', 'attending', 'dietary', 'bus_to', 'bus_from', 'contact', 'song', 'message', 'dinner'];
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

       if (!code) return json({ ok: false, error: 'missing code' });

       const rsvps = sheetWithHeaders(RSVP_SHEET, RSVP_HEADERS);
       // A Party's new reply replaces its old rows.
       deleteRowsWithCode(rsvps, code);
       appendText(rsvps, guests.map((g) => [
         p.submitted_at || '', code, p.party || '',
         g.name || '', g.attending || '', g.dietary || '', g.busTo || '', g.busFrom || '',
         g.mobile || '', p.song || '', p.message || '', g.dinner || '',
       ]));

       return json({ ok: true });
     } finally {
       lock.releaseLock();
     }
   }

   // { ok: true, rsvp: null } when the Party hasn't replied; otherwise rsvp
   // is shaped like the reply the page saves: { submitted_at, code, party,
   // contact, song, message, guests: [{ name, attending, dietary, busTo, busFrom, mobile, dinner }] }.
   function doGet(e) {
     const p = (e && e.parameter) || {};
     const code = String(p.code || '').trim();
     const lock = LockService.getScriptLock();
     lock.waitLock(20000);
     try {
       return json({ ok: true, rsvp: code ? findRsvp(code) : null }, p.callback);
     } finally {
       lock.releaseLock();
     }
   }

   function findRsvp(code) {
     const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(RSVP_SHEET);
     if (!sheet || sheet.getLastRow() < 2) return null;
     const rows = sheet.getRange(2, 1, sheet.getLastRow() - 1, RSVP_HEADERS.length).getValues()
       .map((row) => Object.fromEntries(RSVP_HEADERS.map((h, i) => [h, String(row[i])])))
       .filter((row) => row.code === code);
     if (!rows.length) return null;
     const first = rows[0];
     return {
       submitted_at: first.submitted_at, code, party: first.party,
       contact: [...new Set(rows.map((r) => r.contact).filter(Boolean))].join(', '),
       song: first.song, message: first.message,
       guests: rows.map((r) => ({
         name: r.guest, attending: r.attending, dietary: r.dietary, busTo: r.bus_to, busFrom: r.bus_from, mobile: r.contact, dinner: r.dinner,
       })),
     };
   }

   // The page reads JSON with fetch. A `callback` (JSONP) is there in case a
   // browser ever refuses the cross-origin read.
   function json(body, callback) {
     if (callback && /^[\w.$]+$/.test(callback)) {
       return ContentService
         .createTextOutput(`${callback}(${JSON.stringify(body)})`)
         .setMimeType(ContentService.MimeType.JAVASCRIPT);
     }
     return ContentService
       .createTextOutput(JSON.stringify(body))
       .setMimeType(ContentService.MimeType.JSON);
   }

   // Rewrites the header row every time, so it follows the columns above.
   function sheetWithHeaders(name, headers) {
     const book = SpreadsheetApp.getActiveSpreadsheet();
     const sheet = book.getSheetByName(name) || book.insertSheet(name);
     if (sheet.getLastRow() === 0) appendText(sheet, [headers]);
     else sheet.getRange(1, 1, 1, headers.length).setNumberFormat('@').setValues([headers]);
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

The form only appears for a Party remembered from their Personal link, and
posts urlencoded fields (`submitted_at`, `code`, `party`, `contact`, `song`,
`message`, and `guests` as a JSON string of
`[{ name, attending, dietary, busTo, busFrom, mobile, dinner }]`). Apps Script
answers through the same redirect as the lookup below, so the page can read
it: the thank-you only shows once it says `{ ok: true }`. If that answer can't
be read, the page asks the Sheet for the Party's reply and counts it as sent
only if the Sheet has this very one (same `submitted_at`); otherwise the guest
sees the "email or text us" failure message, and nothing is saved on their
device. With no endpoint set, a dev server logs the payload to the console and
shows the thank-you. A production build shows the failure message.

`busTo` (where the Guest gets on to come to the venue) and `busFrom` (where
they get off on the way home) are a town from `BUS_STOPS` in
`src/components/details/rsvp.ts` (Berry, Gerringong or Kiama), or `''` when the
Guest isn't coming or isn't taking the bus that way: the bus questions are
optional, with no "No thanks". The exact stops aren't named yet, so each Guest
taking the bus gives a `mobile`, to sort out stops and times; it's empty
otherwise, and goes in that Guest's `contact` column. The post's own `contact`
is the Party's bus mobiles, each once, for the Log. A town no longer in
`BUS_STOPS`, or an older reply's `none`, reads back as not taking the bus.
`dinner` (dinner at the Berry Hotel the night before) is `yes` or `no` for
every Guest coming, as the form requires it, and `''` otherwise. `message` is
the form's "A note for us".
The script keeps the RSVPs header row in step with `RSVP_HEADERS`, but rows
already in the sheet keep the columns they were written with. After changing
columns (as when `bus` became `bus_to` and `bus_from`), delete the old test
rows from the RSVPs tab.

The page also reads a Party's reply back with a plain `GET …/exec?code=<code>`
(no custom headers, so no CORS preflight; Apps Script answers through a
redirect to `script.googleusercontent.com`). It shows this device's saved copy
straight away, swaps in the Sheet's copy if that was sent later, and quietly
keeps what it has if the lookup fails or takes more than 5 seconds. Anyone who
knows an Invite code can read that Party's reply this way.

Every new deployment of the Apps Script gets a **new URL**. To change the
script and keep the same URL:

1. Paste the new script over the old one and save.
2. **Deploy → Manage deployments**, pick the existing web app deployment, and
   click the pencil (edit).
3. Under **Version**, choose **New version**, then **Deploy**.
4. If Google asks for permissions again, review and allow them.

The URL stays the same, so the site doesn't need rebuilding. To check it,
open `…/exec?code=<a real code>` in a browser: it should show
`{"ok":true,"rsvp":…}`.

## Deployment

Every push to `main` builds and deploys through `.github/workflows/deploy.yml` (GitHub Pages, custom domain patrickandamelia.com). The `PUBLIC_RSVP_ENDPOINT` repo secret is read at build time, so after changing it, re-run the workflow or push again.

## Stack

- Astro 7, static output, `compressHTML: true` (keeps spaces in the "P & A" monogram)
- React 19 + React Three Fiber + drei for the Garden; butterflies are DOM/CSS
- Plain scoped CSS; Cormorant Garamond and Montserrat, self-hosted under `public/fonts/` (`src/components/SiteFonts.astro`)
- Garden asset pipelines: `pnpm prepare:garden-ground`, `pnpm generate:garden-trees` (see docs/GARDEN_*.md)
