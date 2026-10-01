// The Garden: the site's landing experience. The Review panel (dev only)
// compares visual variants; guests always get the defaults below. The page
// renders on the server so the opening text is in the HTML before any script;
// three.js arrives later in its own chunk, behind the cover.
import { Component, lazy, useCallback, useEffect, useRef, useState, type ReactNode, type CSSProperties } from 'react';
import GardenButterfly from './GardenButterfly';
import ButterflyArtwork from './ButterflyArtwork';
import { BUTTERFLY_COLOR_ORDER, BUTTERFLY_COLOR_LABELS } from './butterflyColors';
import { useGardenButterflies, type ButterflyVisit } from './useGardenButterflies';
import type { GroundStyle, RockStyle } from './GardenGround';
import type { PlantStyle } from './gardenPlantGeometry';
import './garden.css';
import './gardenLoader.css';

const GardenCanvas = lazy(() => import('./GardenCanvas'));
const BASE = import.meta.env.BASE_URL;
function ReleasedButterfly({ visit, paused, available, openingReleased, onLand, onRetire }: {
  visit: ButterflyVisit; paused: boolean; available: boolean; openingReleased: boolean; onLand: () => void; onRetire: (id: number) => void;
}) {
  const onComplete = useCallback(() => onRetire(visit.id), [visit.id, onRetire]);
  return <GardenButterfly paused={paused} perch={visit.perch} landingAngle={visit.landingAngle} color={visit.color}
    opening={visit.opening} openingReleased={openingReleased} available={available} onLand={onLand} onComplete={onComplete} />;
}

const MEMORY_START = .20, MEMORY_END = .82;
const memories = [
  { file: '20191122_191734.jpg', caption: 'The early days.', alt: 'Patrick and Amelia with a friend beside the harbour' },
  { file: 'IMG_5509.jpg', caption: 'And then, this.', alt: 'Patrick and Amelia smiling together on a night out' },
  { file: 'IMG_7024.jpg', caption: 'The first trip away.', alt: 'Patrick and Amelia with hot-air balloons in the sky behind them' },
  { file: '944d7da37c56a0522ee21fd47b54a4b0.jpg', caption: 'Dressed up, somewhere with a view.', alt: 'Patrick and Amelia dressed up together at sunset' },
  { file: 'IMG_0466.jpg', caption: 'Us, being us.', alt: 'A playful close-up selfie of Patrick and Amelia' },
];

class CanvasFallback extends Component<{ children: ReactNode; onError: () => void }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  componentDidCatch() { this.props.onError(); }
  // The cover stays up and offers the details instead.
  render() { return this.state.failed ? null : this.props.children; }
}

// Guests with slow connections are offered the details after this long.
const SKIP_AFTER = 10000;

const REVIEW = import.meta.env.DEV;
if (REVIEW) void import('./gardenReview.css');
// Dev only: the monogram hides and shows the Review panel, remembered across reloads.
const REVIEW_HIDDEN = 'pa_dev_review_hidden';

export default function Garden({ greeting }: { greeting?: string }) {
  const [progress, setProgress] = useState(0);
  const [paused, setPaused] = useState(false);
  const [reduced, setReduced] = useState(false);
  const [sceneOnly, setSceneOnly] = useState(false);
  const [lightTrees, setLightTrees] = useState(false);
  const [groundStyle, setGroundStyle] = useState<GroundStyle>('meadow');
  const [rockStyle, setRockStyle] = useState<RockStyle>('moss');
  const [plantStyle, setPlantStyle] = useState<PlantStyle>('varied');
  const [ready, setReady] = useState(false);
  const [openingReleased, setOpeningReleased] = useState(false);
  const [prepared, setPrepared] = useState(false);
  const [failed, setFailed] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [slow, setSlow] = useState(false);
  const [boatLaunchRequest, setBoatLaunchRequest] = useState(0);
  const [showReview, setShowReview] = useState(REVIEW);
  const touchStart = useRef<{ x: number; y: number } | null>(null);
  const cover = useRef<HTMLDivElement>(null);
  // The Garden scrolls inside <main>, not the page (see garden.css).
  const scroller = useRef<HTMLElement>(null);
  const onReady = useCallback(() => setPrepared(true), []);
  const onError = useCallback(() => setFailed(true), []);
  useEffect(() => {
    // A restored scroll position would open on a later chapter under the cover.
    history.scrollRestoration = 'manual';
    scroller.current?.scrollTo(0, 0);
    setMounted(true);
    // Dev only: ?slow=8000 holds the cover for 8s from navigation, ?fail fails WebGL.
    if (import.meta.env.DEV && new URLSearchParams(location.search).has('fail')) setFailed(true);
    if (REVIEW && localStorage.getItem(REVIEW_HIDDEN)) setShowReview(false);
  }, []);
  const toggleReview = () => {
    if (showReview) localStorage.setItem(REVIEW_HIDDEN, '1');
    else localStorage.removeItem(REVIEW_HIDDEN);
    setShowReview(!showReview);
  };
  useEffect(() => {
    if (ready || failed) return;
    const timer = setTimeout(() => setSlow(true), SKIP_AFTER - performance.now());
    return () => clearTimeout(timer);
  }, [ready, failed]);
  useEffect(() => {
    if (!prepared || failed) return;
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const hold = import.meta.env.DEV ? Number(new URLSearchParams(location.search).get('slow')) || 0 : 0;
    void document.fonts.ready.then(() => {
      // A short settle lets texture uploads finish before the cover fades.
      if (!cancelled) timer = setTimeout(() => setReady(true), Math.max(300, hold - performance.now()));
    });
    return () => { cancelled = true; clearTimeout(timer); };
  }, [prepared, failed]);
  useEffect(() => {
    document.documentElement.dataset.gardenState = failed ? 'error' : ready ? 'ready' : 'loading';
  }, [ready, failed]);
  useEffect(() => {
    if (!ready || failed) return;
    let frame: number;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const waitForReveal = () => {
      // Start the perch time after the cover's fade, including reduced-motion styles.
      if (cover.current && getComputedStyle(cover.current).visibility !== 'hidden') {
        frame = requestAnimationFrame(waitForReveal);
        return;
      }
      timer = setTimeout(() => setOpeningReleased(true), 1200);
    };
    frame = requestAnimationFrame(waitForReveal);
    return () => { cancelAnimationFrame(frame); clearTimeout(timer); };
  }, [ready, failed]);
  useEffect(() => {
    const query = matchMedia('(prefers-reduced-motion: reduce)');
    const updatePreference = () => setReduced(query.matches);
    const element = scroller.current!;
    const update = () => setProgress(Math.min(1, element.scrollTop / Math.max(1, element.scrollHeight - element.clientHeight)));
    updatePreference(); update();
    query.addEventListener('change', updatePreference);
    element.addEventListener('scroll', update, { passive: true });
    window.addEventListener('resize', update);
    return () => {
      query.removeEventListener('change', updatePreference);
      element.removeEventListener('scroll', update); window.removeEventListener('resize', update);
    };
  }, []);
  const chapter = progress < MEMORY_START ? 0 : progress < MEMORY_END ? 1 : 2;
  const butterflies = useGardenButterflies({ chapter, paused, disabled: reduced, sceneOnly, ready });
  const memoryIndex = Math.max(0, Math.min(memories.length - 1,
    Math.floor((progress - MEMORY_START) / (MEMORY_END - MEMORY_START) * memories.length)));
  const goToProgress = (next: number) => {
    setProgress(next);
    const element = scroller.current!;
    element.scrollTo({ top: (element.scrollHeight - element.clientHeight) * next, behavior: 'instant' });
  };
  const scrollToMemory = (index: number) => {
    const wrapped = (index + memories.length) % memories.length;
    goToProgress(MEMORY_START + (wrapped + .5) / memories.length * (MEMORY_END - MEMORY_START));
  };
  const scrollToChapter = (index: number) => {
    // The camera already eases between chapters; native smooth scrolling would
    // introduce a second animation and delay the content on slower devices.
    if (index === 1) scrollToMemory(0);
    else goToProgress(index === 0 ? 0 : 1);
  };
  const nextStop = () => {
    if (chapter === 1 && memoryIndex < memories.length - 1) scrollToMemory(memoryIndex + 1);
    else scrollToChapter(chapter === 2 ? 0 : chapter + 1);
  };
  const state = failed ? 'error' : ready ? 'ready' : 'loading';
  return <main ref={scroller} className={`garden-prototype ${sceneOnly ? 'garden-scene-only' : ''}`} data-state={state} aria-busy={state === 'loading'}>
    <div className="garden-stage">
      <div className={`garden-canvas ${prepared ? 'is-ready' : ''}`} aria-hidden="true">
        <CanvasFallback onError={onError}>
          {mounted && !failed && <GardenCanvas frameloop={!ready ? 'never' : paused || reduced ? 'demand' : 'always'} prepare={butterflies.settled} progress={progress} paused={paused} reduced={reduced} onReady={onReady} onError={onError} boatLaunchRequest={boatLaunchRequest} lightTrees={lightTrees} groundStyle={groundStyle} rockStyle={rockStyle} plantStyle={plantStyle} />}
        </CanvasFallback>
      </div>
      <div className="garden-wash" aria-hidden="true" />
      {/* Beneath the opening text and butterflies, which stay put as it fades. */}
      <div ref={cover} className="garden-cover" inert={state === 'ready'}>
        <p className="garden-visually-hidden" role="status">{failed ? 'The garden couldn’t open. The details are just below.' : ready ? '' : 'Preparing the garden'}</p>
      </div>
    </div>
    {butterflies.visits.map(visit => <ReleasedButterfly key={visit.id} visit={visit} paused={paused}
      openingReleased={openingReleased && !failed} available={butterflies.validPerches.has(visit.perch.key)} onLand={butterflies.land} onRetire={butterflies.retire} />)}
    <header className="garden-header garden-copy garden-chrome" inert={state !== 'ready'}>
      <button className="garden-monogram" onClick={REVIEW ? toggleReview : () => scrollToChapter(0)} aria-label={REVIEW ? 'Toggle the Review panel' : 'Back to the beginning'}>P<span>&</span>A</button>
      <span className="garden-header-date">16 APRIL 2027</span>
      <div className="garden-header-links">
        <a className="garden-invitation-link" href={`${BASE}details/`}>The details</a>
        <a className="garden-invitation-link" href={`${BASE}details/#rsvp`}>RSVP <span aria-hidden="true">↗</span></a>
      </div>
    </header>

    <div className="garden-panels garden-copy">
      <section className={`garden-panel garden-arrival ${chapter === 0 ? 'is-active' : ''}`} inert={chapter !== 0 || sceneOnly} aria-hidden={chapter !== 0 || sceneOnly}>
        <p className="garden-eyebrow">{greeting ? `${greeting}, together with our favourite people` : 'Together with our favourite people'}</p>
        <h1><b className="garden-perch">P</b>atrick <span>&</span> <b className="garden-perch">A</b>melia</h1>
        <p className="garden-subtitle">A new chapter, together.</p>
        <div className="garden-date"><span>16 . 04 . 2027</span><i /><span>Jasper’s Berry</span></div>
        {/* Out of flow, so neither link can move the text above. */}
        <div className="garden-arrival-actions">
          <a className={`garden-skip ${slow && state === 'loading' ? 'is-visible' : ''}`} href={`${BASE}details/`}>Skip to the details <span aria-hidden="true">→</span></a>
          <a className={`garden-button garden-details-fallback ${failed ? 'is-visible' : ''}`} href={`${BASE}details/`}>See the details <span aria-hidden="true">→</span></a>
        </div>
      </section>

      <section className={`garden-panel garden-memory ${chapter === 1 ? 'is-active' : ''}`} inert={chapter !== 1 || sceneOnly} aria-hidden={chapter !== 1 || sceneOnly}>
        <div className="garden-album" role="group" aria-label="Our photographs" onKeyDown={event => {
          if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
            event.preventDefault(); scrollToMemory(memoryIndex + (event.key === 'ArrowLeft' ? -1 : 1));
          }
        }}>
          <div className="garden-photo-stack" onTouchStart={event => {
            const touch = event.touches[0]; touchStart.current = { x: touch.clientX, y: touch.clientY };
          }} onTouchEnd={event => {
            if (!touchStart.current) return;
            const touch = event.changedTouches[0], dx = touch.clientX - touchStart.current.x, dy = touch.clientY - touchStart.current.y;
            if (Math.abs(dx) > 45 && Math.abs(dx) > Math.abs(dy)) scrollToMemory(memoryIndex + (dx < 0 ? 1 : -1));
            touchStart.current = null;
          }}>
            {/* Stable card positions keep side photos behind the centre throughout
                a change. Only their contents crossfade, including on rapid scrolls. */}
            {[-1, 0, 1].map(offset => <div key={offset}
              className={`garden-photo-slot ${offset === 0 ? 'is-current' : ''}`}
              aria-hidden={offset !== 0}
              style={{ '--photo-offset': offset } as CSSProperties}>
              {memories.map((memory, i) => {
                const visible = i === (memoryIndex + offset + memories.length) % memories.length;
                return <figure key={memory.file} className={visible ? 'is-visible' : ''} aria-hidden={offset !== 0 || !visible}>
                  <img src={ready ? `${BASE}photos/${memory.file}` : undefined} alt={offset === 0 && visible ? memory.alt : ''} decoding="async" draggable={false} />
                  <figcaption>{memory.caption}</figcaption>
                </figure>;
              })}
            </div>)}
          </div>
          <div className="garden-photo-controls">
            <button aria-label="Previous photograph" onClick={() => scrollToMemory(memoryIndex - 1)}>←</button>
            <div className="garden-photo-dots">
              {memories.map((memory, i) => <button key={memory.file} aria-label={`Photograph ${i + 1}: ${memory.caption}`}
                aria-pressed={i === memoryIndex} onClick={() => scrollToMemory(i)}><span /></button>)}
            </div>
            <button aria-label="Next photograph" onClick={() => scrollToMemory(memoryIndex + 1)}>→</button>
          </div>
          <p className="garden-photo-count">0{memoryIndex + 1} <span>/ 05</span></p>
        </div>
        <div className="garden-memory-copy">
          <p className="garden-eyebrow">Our story</p>
          <h2><b className="garden-perch">A</b> lifetime of<br /><em>little moments.</em></h2>
          <p>And now, one more to share<br />with the people we love.</p>
          <button className="garden-text-link" onClick={() => scrollToChapter(2)}>The next chapter <span aria-hidden="true">→</span></button>
        </div>
      </section>

      <section className={`garden-panel garden-celebrate ${chapter === 2 ? 'is-active' : ''}`} inert={chapter !== 2 || sceneOnly} aria-hidden={chapter !== 2 || sceneOnly}>
        <p className="garden-eyebrow">We’re getting married</p>
        <h2><b className="garden-perch">M</b>eet us<br /><em>in the garden.</em></h2>
        <p className="garden-venue">Jasper’s Berry · Berry, NSW</p>
        <p className="garden-eyebrow">Friday, 16 April 2027</p>
        <a className="garden-button" href={`${BASE}details/`}>The details &amp; RSVP <span aria-hidden="true">→</span></a>
      </section>
    </div>

    <nav className="garden-chapters garden-copy garden-chrome" aria-label="Garden chapters" inert={state !== 'ready'}>
      {['The beginning', 'Our story', 'The celebration'].map((name, i) => <button key={name}
        onClick={() => scrollToChapter(i)} aria-label={name} aria-current={chapter === i ? 'step' : undefined}>
        <span className="garden-chapter-number">0{i + 1}</span><span className="garden-chapter-line" /><span className="garden-chapter-name">{name}</span>
      </button>)}
    </nav>
    <div className="garden-bottom garden-copy garden-chrome" inert={state !== 'ready'}>
      <div className="garden-creature-actions">
      <button className="garden-boat-launch" disabled={!ready} onClick={() => setBoatLaunchRequest(value => value + 1)} aria-label="Float a boat">
        <svg width="23" height="20" viewBox="0 0 28 24" fill="none" aria-hidden="true">
          <path d="m2 13 12 3 12-3-6 8H8L2 13Zm5 1 7-11 7 11M14 3v13" stroke="currentColor" strokeWidth="1" strokeLinejoin="round" />
        </svg>
        <span>Float a boat</span>
      </button>
      <button className="garden-boat-launch" disabled={!butterflies.canRelease}
        onClick={() => butterflies.release()}>
        <svg width="23" height="23" viewBox="0 0 28 28" fill="none" aria-hidden="true">
          <path d="M14 12C9 3 3 2 3 7c0 4 3 7 7 8-6 0-6 7-2 7 3 0 5-4 6-7m0-3c5-9 11-10 11-5 0 4-3 7-7 8 6 0 6 7 2 7-3 0-5-4-6-7m0-5v12m0-12-3-4m3 4 3-4" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        <span>Release a butterfly</span>
      </button>
      </div>
      <button className="garden-scroll-cue" onClick={nextStop}>
        {chapter === 2 ? 'Back to the beginning' : 'Wander with us'} <span aria-hidden="true">{chapter === 2 ? '↑' : '↓'}</span>
      </button>
    </div>
    {REVIEW && showReview && <aside className="garden-review" aria-label="Review panel">
      <span className="garden-study-label">Garden study <b>02</b></span>
      <span className="garden-review-divider" />
      <details className="garden-butterfly-colours">
        <summary>Butterfly colours</summary>
        <div className="garden-butterfly-palette" aria-label="Butterfly colour previews">
          {BUTTERFLY_COLOR_ORDER.map(color => <figure key={color}>
            <div aria-hidden="true"><ButterflyArtwork color={color} /></div>
            <figcaption>{BUTTERFLY_COLOR_LABELS[color]}</figcaption>
          </figure>)}
        </div>
      </details>
      <label className="garden-material-selector">Ground
        <select aria-label="Ground material" value={groundStyle} onChange={event => setGroundStyle(event.target.value as GroundStyle)}>
          <option value="original">Original</option><option value="leafy">Leafy</option><option value="meadow">Meadow</option>
        </select>
      </label>
      <label className="garden-material-selector">Rocks
        <select aria-label="Rock style" value={rockStyle} onChange={event => setRockStyle(event.target.value as RockStyle)}>
          <option value="original">Original</option><option value="moss">Mossy</option>
        </select>
      </label>
      <label className="garden-material-selector">Plants
        <select aria-label="Plant variety" value={plantStyle} onChange={event => setPlantStyle(event.target.value as PlantStyle)}>
          <option value="original">Original</option><option value="varied">Varied</option>
        </select>
      </label>
      <button onClick={() => setLightTrees(value => !value)} aria-pressed={lightTrees}
        aria-label="Use light EZ-Tree colours" title={lightTrees ? 'Switch to dark EZ-Tree colours' : 'Switch to light EZ-Tree colours'}>
        Trees: {lightTrees ? 'Light' : 'Dark'}
      </button>
      <button onClick={() => setPaused(!paused)} disabled={reduced} aria-pressed={paused || reduced}>
        {reduced ? 'Reduced motion' : paused ? 'Resume motion' : 'Pause motion'}
      </button>
      <button onClick={() => setSceneOnly(!sceneOnly)} aria-pressed={sceneOnly}>{sceneOnly ? 'Show invitation' : 'Scene only'}</button>
    </aside>}
    <div className="garden-scroll-space" />
  </main>;
}
