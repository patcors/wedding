// Writes invites/out/index.html: every Party's image and message on one page,
// for sending invitations by hand (a Messenger group chat, or a text). Serve
// invites/out to open it on a laptop or phone. See README "Sending by hand".
// --out=DIR writes beside images somewhere other than invites/out.
import { readFile, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parties } from '../src/data/parties.ts';
import { DRAFT_MARKER, personalLink, renderMessage, unknownPlaceholders } from './invites.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
const out = resolve(root, process.argv.find((arg) => arg.startsWith('--out='))?.slice(6) ?? 'invites/out') + '/';
const template = await readFile(`${root}invites/message.txt`, 'utf8');
const unknown = unknownPlaceholders(template);
if (template.includes(DRAFT_MARKER) || unknown.length) {
  console.error(`invites/message.txt ${unknown.length ? `has ${unknown.map((name) => `{${name}}`).join(', ')}` : 'is still a draft'}; fix it first.`);
  process.exit(1);
}

const escape = (text) => text.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
const missing = parties.filter((p) => !existsSync(`${out}${p.code}.png`)).map((p) => p.code);

const cards = parties.map((p) => `
  <section class="party" data-search="${escape(`${p.code} ${p.greeting}`.toLowerCase())}">
    <a class="image" href="${p.code}.png" download="${p.code}.png"><img src="${p.code}.png" alt="${escape(p.greeting)}'s invitation" loading="lazy"></a>
    <div class="words">
      <h2>${escape(p.greeting)} <span>${p.code}</span></h2>
      <pre>${escape(renderMessage(template, p))}</pre>
      <p>
        <button type="button" data-copy="message">Copy message</button>
        <a href="${p.code}.png" download="${p.code}.png">Download image</a>
        <a href="${personalLink(p.code)}" target="_blank" rel="noopener">Open link</a>
      </p>
    </div>
  </section>`).join('');

await writeFile(`${out}index.html`, `<!doctype html>
<html lang="en-AU">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex">
<title>Invitations to send</title>
<style>
  body { margin: 0; padding: 16px; font: 16px/1.45 system-ui, sans-serif; background: #fbf8ee; color: #3b2a20; }
  header { position: sticky; top: 0; padding: 8px 0 12px; background: #fbf8ee; z-index: 1; }
  h1 { margin: 0 0 8px; font-size: 20px; }
  input { width: 100%; max-width: 420px; box-sizing: border-box; padding: 10px 12px; font: inherit; border: 1px solid #c9b9a6; border-radius: 8px; }
  .party { display: grid; grid-template-columns: 200px 1fr; gap: 16px; padding: 16px 0; border-top: 1px solid #e3d8c6; }
  .image img { width: 100%; display: block; border-radius: 6px; box-shadow: 0 1px 4px #0002; }
  h2 { margin: 0 0 8px; font-size: 18px; }
  h2 span { font-weight: normal; font-size: 14px; color: #8a7765; }
  pre { margin: 0 0 12px; padding: 12px; white-space: pre-wrap; font: inherit; background: #fff; border-radius: 8px; }
  p { display: flex; flex-wrap: wrap; gap: 12px; align-items: center; margin: 0; }
  button { padding: 8px 14px; font: inherit; color: #fff; background: #5a3d2b; border: 0; border-radius: 8px; cursor: pointer; }
  a { color: #5a3d2b; }
  @media (max-width: 560px) { .party { grid-template-columns: 1fr; } .image { max-width: 320px; } }
</style>
</head>
<body>
<header>
  <h1>Invitations to send (${parties.length} Parties)</h1>
  <input type="search" placeholder="Find a Party by name or code" aria-label="Find a Party">
</header>
<main>${cards}
</main>
<script>
  const search = document.querySelector('input');
  search.addEventListener('input', () => {
    const q = search.value.trim().toLowerCase();
    for (const party of document.querySelectorAll('.party')) party.hidden = !party.dataset.search.includes(q);
  });
  // Served over plain http on the tailnet, so navigator.clipboard may be
  // missing; a selected textarea and execCommand works everywhere.
  document.addEventListener('click', async (event) => {
    const button = event.target.closest('[data-copy]');
    if (!button) return;
    const text = button.closest('.party').querySelector('pre').textContent;
    try { await navigator.clipboard.writeText(text); } catch {
      const area = Object.assign(document.createElement('textarea'), { value: text });
      document.body.append(area); area.select(); document.execCommand('copy'); area.remove();
    }
    button.textContent = 'Copied';
    setTimeout(() => { button.textContent = 'Copy message'; }, 1500);
  });
</script>
</body>
</html>
`);
console.log(`${out}index.html: ${parties.length} Parties`);
if (missing.length) console.log(`No image yet for ${missing.join(', ')}: run \`corepack pnpm invites\`.`);
