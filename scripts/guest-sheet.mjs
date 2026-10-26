// Writes the Sheet's Invites and Guests tabs as CSVs from the guest list, to
// import into the RSVP Sheet. See README "Tracking invitations".
import { mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { parties } from '../src/data/parties.ts';
import { sheetRows, toCsv } from './invites.mjs';

const out = fileURLToPath(new URL('../invites/out/', import.meta.url));
await mkdir(out, { recursive: true });
const { invites, guests } = sheetRows(parties);
await writeFile(`${out}invites.csv`, toCsv(invites));
await writeFile(`${out}guests.csv`, toCsv(guests));
console.log(`invites/out/invites.csv: ${invites.length - 1} Parties`);
console.log(`invites/out/guests.csv: ${guests.length - 1} Guests`);
