// The voyage's timeline as text, for checking crowding without a browser:
// the moments where more than two scenery pieces compete in the picture, on
// desktop and on a phone, each with what is in view, busiest first. The same numbers as
// /dev/timeline (src/components/garden/voyageTimeline.ts).
//
//   node scripts/voyage-timeline.mjs                    both layouts' crowded moments
//   node scripts/voyage-timeline.mjs --layout phone     one layout
//   node scripts/voyage-timeline.mjs --pieces           also every piece's windows, and what each stretch holds
//   node scripts/voyage-timeline.mjs --top 20           list more of the busiest moments
//   node scripts/voyage-timeline.mjs --at 0.62          what is in view at p .62
//   node scripts/voyage-timeline.mjs --json             all of it as JSON
import { sceneryCatalog } from '../src/components/garden/sceneryCatalog.ts';
import { CROWDED, LAYOUTS, dateAt, timeline, windowLabel } from '../src/components/garden/voyageTimeline.ts';

const args = process.argv.slice(2);
const option = name => { const i = args.indexOf(name); return i < 0 ? null : args[i + 1]; };
const layouts = option('--layout') ? [option('--layout')] : Object.keys(LAYOUTS);
for (const name of layouts) if (!LAYOUTS[name]) throw new Error(`No layout "${name}": use ${Object.keys(LAYOUTS).join(' or ')}`);
const at = option('--at') === null ? null : Number(option('--at'));

const results = Object.fromEntries(layouts.map(name => [name, timeline(sceneryCatalog(LAYOUTS[name].width), LAYOUTS[name])]));
if (args.includes('--json')) {
  console.log(JSON.stringify(results));
  process.exit(0);
}

const within = (spans, p) => spans.some(([a, b]) => p >= a - 1e-9 && p <= b + 1e-9);
for (const name of layouts) {
  const result = results[name];
  console.log(`\n${name.toUpperCase()}`);
  if (at !== null) {
    const i = Math.round(at / result.step);
    const seen = result.pieces.filter(piece => within(piece.seen, at));
    console.log(`  p ${at} (${dateAt(at)}): ${result.counts[i]} counted in view`);
    for (const piece of seen) console.log(`    ${piece.counted ? '*' : ' '} ${piece.name} (${piece.bank})`);
    continue;
  }
  if (args.includes('--pieces')) {
    for (const piece of result.pieces) console.log(`  ${piece.name.padEnd(32)} ${piece.seen.map(([a, b]) => windowLabel(a, b)).join('; ') || 'never in the picture'}`);
    console.log('');
  }
  const top = Number(option('--top') ?? 12);
  console.log(`  Busiest moments (the same ${CROWDED + 1} or more counted pieces in view for at least .0015 of p), most first:`);
  for (const moment of result.busiest.slice(0, top)) {
    console.log(`  ${moment.count} in view, ${windowLabel(moment.from, moment.to)}: ${moment.pieces.map(piece => piece.name).join(', ')}`);
  }
  console.log(`\n  ${result.crowded.length} crowded stretches (more than ${CROWDED} counted pieces in view):`);
  for (const stretch of result.crowded) {
    console.log(`  ${windowLabel(stretch.from, stretch.to)}, up to ${stretch.peak} at once (p ${stretch.at.toFixed(3)}, ${dateAt(stretch.at)})`);
    if (args.includes('--pieces')) for (const piece of stretch.pieces) console.log(`      ${piece.name.padEnd(32)} ${windowLabel(piece.from, piece.to)}`);
  }
}
