// Dev only: the page's half of the Review panel's inspect mode (see
// docs/VOYAGE.md, "Inspect and notes"). InspectControls sits in the Review
// panel: the Inspect toggle and the notes, with "Go there", "Copy all", a
// link to the moment on screen and "Clear". InspectLayer shows the label for
// what is under the mouse or a tap, the note box, and on load follows ?at=.
// Garden.tsx loads this only on the dev server.
import { useEffect, useRef, useState, type CSSProperties, type SyntheticEvent } from 'react';
import { createPortal } from 'react-dom';
import type { Pace } from '../journeyPace';
import { atValue, createNote, formatNotes, formatP, moment, parseAt, shownDate, type Viewport } from './inspect';
import { getInspect, setInspect, useInspect, type InspectHit } from './inspectStore';
import './inspect.css';

type Go = (p: number, jump?: boolean) => void;
const PHONE = 700;
const viewport = (): Viewport => innerWidth <= PHONE || matchMedia('(hover: none) and (pointer: coarse)').matches ? 'phone' : 'desktop';

// The clipboard API needs a secure page, which the dev server reached over
// the network isn't; the old copy command works there.
async function copyText(text: string) {
  try { await navigator.clipboard.writeText(text); return true; } catch { /* try the old way */ }
  const area = Object.assign(document.createElement('textarea'), { value: text, readOnly: true });
  Object.assign(area.style, { position: 'fixed', top: '0', opacity: '0' });
  document.body.append(area);
  area.select();
  const copied = document.execCommand('copy');
  area.remove();
  return copied;
}

// Near the point, flipped back inside the screen at its edges.
function near(screen: InspectHit['screen'], size: { width: number; height: number }): CSSProperties {
  const gap = 14, edge = 8;
  const left = screen.x + gap + size.width > innerWidth - edge ? Math.max(edge, screen.x - gap - size.width) : screen.x + gap;
  const top = screen.y + gap + size.height > innerHeight - edge ? Math.max(edge, screen.y - gap - size.height) : screen.y + gap;
  return { left, top };
}
function useSize<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [size, setSize] = useState({ width: 260, height: 90 });
  useEffect(() => {
    const element = ref.current;
    if (!element) return;
    // Only a real change re-renders: the observer reports once as it starts, and the element may mount late, so it is observed afresh each render.
    const observer = new ResizeObserver(() => setSize(was => was.width === element.offsetWidth && was.height === element.offsetHeight ? was : { width: element.offsetWidth, height: element.offsetHeight }));
    observer.observe(element);
    return () => observer.disconnect();
  });
  return [ref, size] as const;
}

function Facts({ hit }: { hit: InspectHit }) {
  const { described, world, bank, p } = hit;
  const when = moment(described);
  return <>
    <strong className="garden-inspect-name">{described.name}</strong>
    <span>{when ? `Moment: ${when}` : 'No milestone of its own'}</span>
    <code>{described.file ?? `file unknown (${described.path || 'unnamed'})`}</code>
    <span className="garden-inspect-quiet">{world.map(v => v.toFixed(2)).join(', ')}{bank && ` · ${bank}`} · p {formatP(p)}, {shownDate(p)}</span>
  </>;
}

function Label({ hit }: { hit: InspectHit }) {
  const [ref, size] = useSize<HTMLDivElement>();
  return <div ref={ref} className={`garden-inspect-label ${hit.touch ? 'is-touch' : ''}`} style={near(hit.screen, size)} role="status">
    <Facts hit={hit} />
    {hit.touch && <span className="garden-inspect-buttons">
      <button type="button" onClick={() => setInspect({ draft: hit, hover: null })}>Add a note</button>
      <button type="button" onClick={() => setInspect({ hover: null })} aria-label="Close the label">Close</button>
    </span>}
  </div>;
}

function NoteBox({ hit }: { hit: InspectHit }) {
  const [text, setText] = useState('');
  const [ref, size] = useSize<HTMLFormElement>();
  // On a phone, upright or on its side, it sits at the top, clear of the keyboard.
  const phone = innerWidth <= PHONE || innerHeight <= 500;
  const save = (event: SyntheticEvent) => {
    event.preventDefault();
    if (!text.trim()) return;
    const note = createNote(hit, text, viewport(), Date.now());
    const notes = [...getInspect().notes, note].sort((a, b) => a.p - b.p || a.at - b.at);
    setInspect({ notes, draft: null });
  };
  return <>
    <span className="garden-inspect-pin" style={{ left: hit.screen.x, top: hit.screen.y }} aria-hidden="true" />
    <form ref={ref} className={`garden-inspect-note ${phone ? 'is-phone' : ''}`} style={phone ? undefined : near(hit.screen, size)} onSubmit={save}
      onKeyDown={event => { if (event.key === 'Escape') setInspect({ draft: null }); }}>
      <Facts hit={hit} />
      <textarea aria-label={`Note on ${hit.described.name}`} placeholder="What should change here?" rows={3} value={text} autoFocus
        onChange={event => setText(event.target.value)}
        onKeyDown={event => { if (event.key === 'Enter' && !event.shiftKey) save(event); }} />
      <span className="garden-inspect-buttons">
        <button type="submit" disabled={!text.trim()}>Save note</button>
        <button type="button" onClick={() => setInspect({ draft: null })}>Cancel</button>
      </span>
    </form>
  </>;
}

// The label and note box, over everything; and ?at= once the scene is up.
export default function InspectLayer({ go, ready }: { go: Go; ready: boolean }) {
  const { on, hover, draft } = useInspect(state => state);
  const jumped = useRef(false);
  useEffect(() => {
    if (!ready || jumped.current) return;
    jumped.current = true;
    const at = new URLSearchParams(location.search).get('at');
    const p = parseAt(at);
    if (p !== null) go(p, true);
    else if (at !== null) console.warn(`?at=${at} is neither a progress from 0 to 1 nor a milestone's id`);
  }, [ready, go]);
  if (!on) return null;
  return createPortal(<div className="garden-inspect-layer">
    {draft ? <NoteBox key={`${draft.screen.x},${draft.screen.y},${draft.p}`} hit={draft} /> : hover && <Label hit={hover} />}
  </div>, document.body);
}

// In the Review panel.
export function InspectControls({ pace, go }: { pace: Pace; go: Go }) {
  const { on, notes } = useInspect(state => state);
  const [open, setOpen] = useState(false);
  const [said, setSaid] = useState('');
  const [clearing, setClearing] = useState(false);
  const [manual, setManual] = useState<string | null>(null);
  useEffect(() => {
    if (!said) return;
    const timer = setTimeout(() => setSaid(''), 2000);
    return () => clearTimeout(timer);
  }, [said]);
  const copy = async (text: string, done: string) => {
    if (await copyText(text)) { setSaid(done); setManual(null); } else setManual(text);
  };
  const link = () => {
    const url = new URL(location.href);
    url.searchParams.set('at', atValue(pace.progress));
    return url.toString();
  };
  return <span className="garden-inspect-controls">
    <button type="button" aria-pressed={on} onClick={() => setInspect({ on: !on })}>Inspect{on ? ': on' : ''}</button>
    <button type="button" aria-expanded={open} onClick={() => { setOpen(!open); setClearing(false); }}>Notes ({notes.length})</button>
    {open && <div className="garden-inspect-notes" role="group" aria-label="Notes for Claude">
      {notes.length ? <ol>{notes.map((note, i) => <li key={note.id}>
        <span className="garden-inspect-number">{i + 1}</span>
        <span className="garden-inspect-note-text">
          <span className="garden-inspect-quiet">{note.date} · p {formatP(note.p)} · {note.viewport}</span>
          <strong>{note.object.name}</strong> {note.text}
        </span>
        <span className="garden-inspect-buttons">
          <button type="button" onClick={() => { go(note.p, true); if (innerWidth <= PHONE) setOpen(false); }}>Go there</button>
          <button type="button" onClick={() => setInspect({ notes: notes.filter(n => n !== note) })} aria-label={`Delete note ${i + 1}`}>Delete</button>
        </span>
      </li>)}</ol> : <p className="garden-inspect-empty">No notes yet. Turn Inspect on, then click something in the scene (on a phone, tap it, then “Add a note”).</p>}
      <span className="garden-inspect-actions">
        <button type="button" disabled={!notes.length} onClick={() => copy(formatNotes(notes), 'Copied the notes')}>Copy all</button>
        <button type="button" onClick={() => copy(link(), 'Copied the link')}>Copy link to this moment</button>
        {clearing
          ? <><button type="button" className="garden-inspect-danger" onClick={() => { setInspect({ notes: [] }); setClearing(false); }}>Clear {notes.length} {notes.length === 1 ? 'note' : 'notes'}</button>
            <button type="button" onClick={() => setClearing(false)}>Keep them</button></>
          : <button type="button" disabled={!notes.length} onClick={() => setClearing(true)}>Clear</button>}
      </span>
      <span className="garden-inspect-said" role="status">{said}</span>
      {manual !== null && <textarea className="garden-inspect-manual" readOnly value={manual} aria-label="Copy this by hand" rows={4} onFocus={event => event.target.select()} />}
    </div>}
  </span>;
}
