// The Garden: the site's landing experience. The Review panel (dev only)
// compares visual variants; guests always get the defaults below. The page
// renders on the server so the opening text is in the HTML before any script;
// three.js arrives later in its own chunk, behind the cover.
import { Component, Suspense, lazy, useCallback, useEffect, useMemo, useRef, useState, type CSSProperties, type MouseEvent, type ReactNode, type RefObject } from 'react';
import GardenButterfly from './GardenButterfly';
import ButterflyArtwork from './ButterflyArtwork';
import { BUTTERFLY_COLOR_ORDER, BUTTERFLY_COLOR_LABELS } from './butterflyColors';
import { useGardenButterflies, type ButterflyVisit } from './useGardenButterflies';
import type { GroundStyle, RockStyle } from './GardenGround';
import type { PlantStyle } from './gardenPlantGeometry';
import { SKY_STYLE, type SkyStyle } from './GardenSky';
import { WATERS, type WaterStyle } from './skyCycle';
import { chapterAt, dateLabel, milestoneAt, nextStop, previousStop, progressAt, stillProgress, storyMonth, type Chapter, type Milestone } from './journey';
import { advancePace, createPace, glidePlan, leashed } from './journeyPace';
import { namesAway } from './openingNames';
import { DATE_LABEL_MODES, DEFAULT_DATE_LABEL, FLIP_EVERY, dateLabelMode, digitDate, flipTowards, shownDate, startFlips, type DateLabelMode, type Flips } from './dateLabelMode';
import { TEXT_LOOKS, inkTurnsWhite, textLook, type TextLook } from './textLook';
import { PREPARE, PREPARE_WHEN, REVIEW_PREPARE, REVIEW_TEXTURES, TEXTURE_WEIGHT, TEXTURE_WEIGHTS, type PrepareWhen, type TextureWeight } from './loadChoices';
import { REVIEW_SEASONS, SEASONS, seasonsOn } from './seasons';
import { PLACES, REVIEW_PLACES, placesOn } from './places';
import { BOAT_LOOK, CATAMARAN_LOOKS, DINGHY_LOOKS, boatLook, type BoatLook, type CatamaranLook, type DinghyLook } from './boatLooks';
import StoryDialog, { STORY_LINK } from './StoryDialog';
import { GUEST_SOUND, GUEST_SOUND_MODE, REVIEW_SOUND, SOUND_MODES, soundMode, type SoundMode } from './soundChoices';
import { useSoundscape } from './useSoundscape';
import './garden.css';
import './gardenScrollCue.css';
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

// The page's chapter, date and milestone follow the progress the scene shows
// (journeyPace.ts: the scroll, eased at no more than the story's pace), so
// they arrive with the boats and the celebration never shows over a scene
// still mid-river. A rolling date changes at most this often, so it reads as
// a gentle count rather than a flicker; a milestone is announced once the
// guest has stayed on it a moment. Here too the scroll is kept within reach
// of the story, the arrow keys and scroll cue send it to a stop, and "The
// next chapter" glides on to the dock until the guest takes over.
const DATE_EVERY = 400, ANNOUNCE_AFTER = 700;
function useVoyage(scroller: RefObject<HTMLElement | null>, reduced: boolean) {
  const pace = useMemo(createPace, []);
  // The raw scroll, 0 to 1.
  const [progress, setProgress] = useState(0);
  const [chapter, setChapter] = useState<Chapter>('arrival');
  const [date, setDate] = useState<string | null>(null);
  const [milestone, setMilestone] = useState<Milestone | null>(null);
  const [gliding, setGliding] = useState(false);
  // Whether the opening title's names have left it for their boats.
  const [away, setAway] = useState(false);
  const controls = useRef({ go: (_next: number, _jump?: boolean) => {}, glide: () => {} });
  useEffect(() => {
    const element = scroller.current!;
    const span = () => Math.max(1, element.scrollHeight - element.clientHeight);
    // `travelling`: the scroll was sent to a stop, so it may be further ahead than the leash allows.
    let frame = 0, shown: string | null | undefined, changed = -Infinity, travelling = false;
    const show = (p: number, settled: boolean, now: number) => {
      setChapter(chapterAt(p));
      setAway(namesAway(p));
      const label = dateLabel(p);
      if (label !== shown && (settled || now - changed >= DATE_EVERY || label === null || shown == null)) {
        shown = label; changed = now; setDate(label);
      }
      setMilestone(milestoneAt(p));
      return label === shown;
    };
    const tick = () => {
      frame = 0;
      const now = performance.now();
      advancePace(pace, now);
      // The glide moves the scroll with it, so a guest who takes over carries on from there.
      if (pace.glide) element.scrollTop = pace.progress * span();
      setGliding(pace.glide !== null);
      const settled = !pace.glide && pace.progress === pace.target;
      if (!show(pace.progress, settled, now) || !settled) frame = requestAnimationFrame(tick);
    };
    const wake = () => { if (!frame && !reduced) frame = requestAnimationFrame(tick); };
    const update = () => {
      const scroll = Math.min(1, element.scrollTop / span());
      if (reduced) {
        // The scene cuts to each milestone's still, and so does the page.
        const still = stillProgress(scroll);
        pace.progress = pace.target = scroll;
        setProgress(scroll); show(still, true, performance.now());
        return;
      }
      let target = scroll;
      if (!pace.glide && !travelling) {
        // However far a fling goes, the page stays within reach of the story.
        target = leashed(scroll, pace.progress);
        if (target !== scroll) element.scrollTop = target > scroll ? Math.ceil(target * span()) : Math.floor(target * span());
      }
      if (!pace.glide) pace.target = target;
      setProgress(target);
      wake();
    };
    const stopGlide = () => {
      pace.glide = null; pace.target = pace.progress;
      setGliding(false);
    };
    // Any wheel, touch, tap or key from the guest hands control back.
    const takeOver = (event: Event) => {
      if (event.target instanceof Element && event.target.closest('.garden-glide')) return;
      travelling = false;
      if (pace.glide) stopGlide();
    };
    const go = (next: number, jump = false) => {
      if (pace.glide) stopGlide();
      // A jump (the monogram) cuts straight there; anything else travels at the story's pace.
      travelling = !jump;
      if (jump || reduced) pace.progress = next;
      pace.target = next;
      setProgress(next);
      element.scrollTo({ top: span() * next, behavior: 'instant' });
      wake();
    };
    controls.current = {
      go,
      glide: () => {
        if (pace.glide) return stopGlide();
        if (reduced) return go(1);
        travelling = false;
        pace.glide = { plan: glidePlan(pace.progress), t: 0 };
        setGliding(true);
        wake();
      },
    };
    // The arrow keys step from the opening through each milestone to the
    // celebration and back, as the photo album's did between photographs.
    const onKey = (event: KeyboardEvent) => {
      takeOver(event);
      if (event.altKey || event.ctrlKey || event.metaKey || event.shiftKey || (event.key !== 'ArrowRight' && event.key !== 'ArrowLeft')) return;
      if (event.target instanceof Element && event.target.closest('input, select, textarea, [contenteditable], .garden-review, dialog')) return;
      const at = element.scrollTop / span();
      event.preventDefault();
      go(event.key === 'ArrowRight' ? nextStop(at) : previousStop(at));
    };
    pace.progress = pace.target = Math.min(1, element.scrollTop / span());
    update();
    element.addEventListener('scroll', update, { passive: true });
    window.addEventListener('resize', update);
    element.addEventListener('wheel', takeOver, { passive: true });
    element.addEventListener('touchstart', takeOver, { passive: true });
    element.addEventListener('pointerdown', takeOver);
    addEventListener('keydown', onKey);
    return () => {
      cancelAnimationFrame(frame);
      stopGlide();
      element.removeEventListener('scroll', update); window.removeEventListener('resize', update);
      element.removeEventListener('wheel', takeOver); element.removeEventListener('touchstart', takeOver);
      element.removeEventListener('pointerdown', takeOver);
      removeEventListener('keydown', onKey);
    };
  }, [scroller, pace, reduced]);
  // Screen readers hear the milestone once the guest settles on it.
  const [announced, setAnnounced] = useState<Milestone | null>(null);
  useEffect(() => {
    const timer = setTimeout(() => setAnnounced(milestone), reduced ? 0 : ANNOUNCE_AFTER);
    return () => clearTimeout(timer);
  }, [milestone, reduced]);
  const go = useCallback((next: number, jump?: boolean) => controls.current.go(next, jump), []);
  const glide = useCallback(() => controls.current.glide(), []);
  return { pace, progress, chapter, date, announced, gliding, away, go, glide };
}

// The month and year each crossfade between two layers. A change mid-fade
// fades the layers on from where they are, so a fast scroll never jumps.
function Crossfade({ value, className }: { value: string; className: string }) {
  const [layers, setLayers] = useState([value, '']);
  const [front, setFront] = useState(0);
  if (value !== layers[front]) {
    const back = 1 - front;
    setLayers(back ? [layers[0], value] : [value, layers[1]]);
    setFront(back);
  }
  return <span className={className}>{layers.map((text, i) => <span key={i} className={i === front ? 'is-shown' : ''}>{text}</span>)}</span>;
}

// Dev only (Review "Digits"): the date as DD-MM-YYYY, read from the eased
// story time every frame. Each digit flips over on its own as it changes, like
// an old flip clock's cards; the day, the month and the year each flip
// together, no faster than their pace (FLIP_EVERY), so a fast scroll flicks
// the days without strobing. Under reduced motion each still's date simply shows.
type Clock = Flips & { was: string[]; flips: number[] };
function DigitClock({ month, reduced }: { month: () => number; reduced: boolean }) {
  const clock = useRef<Clock | null>(null);
  clock.current ??= { ...startFlips(digitDate(month())), was: [], flips: [] };
  const [, setShown] = useState('');
  useEffect(() => {
    let frame = 0;
    const tick = (now: number) => {
      const current = clock.current!, target = digitDate(month());
      const next = reduced ? (target === current.shown ? current : startFlips(target)) : flipTowards(current, target, now);
      if (next !== current) {
        const flipped = (i: number) => next.shown[i] !== current.shown[i];
        clock.current = { ...next, was: [...next.shown].map((_, i) => flipped(i) ? current.shown[i] : current.was[i]),
          flips: [...next.shown].map((_, i) => (current.flips[i] ?? 0) + (flipped(i) ? 1 : 0)) };
        setShown(next.shown);
      }
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [month, reduced]);
  const { shown, was, flips } = clock.current;
  return <span className="garden-voyage-digits">{[...shown].map((char, i) => char === '-'
    ? <span key={i} className="garden-digit-dash">{char}</span>
    : <span key={i} className="garden-digit" style={{ '--flip': `${FLIP_EVERY[i]}ms` } as CSSProperties}>
      {!reduced && flips[i] > 0 && <span key={`was${flips[i]}`} className="is-out">{was[i]}</span>}
      <span key={flips[i] ?? 0} className={!reduced && flips[i] > 0 ? 'is-in' : undefined}>{char}</span>
    </span>)}</span>;
}

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
// Dev only: the Review sky and water, remembered; GardenPage reads the sky to colour Safari's bars to match.
const REVIEW_SKY = 'pa_dev_sky';
const REVIEW_WATER = 'pa_dev_water';
// Dev only: the Review choice of date label (see dateLabelMode.ts), remembered across reloads.
const REVIEW_DATE = 'pa_dev_date_label';
// Dev only: the Review choice of how the copy is set over the scene (see textLook.ts), remembered across reloads.
const REVIEW_TEXT = 'pa_dev_text';
// Dev only: the Review choice of how the boats look (see boatLooks.ts), remembered across reloads.
const REVIEW_DINGHY = 'pa_dev_dinghy', REVIEW_CATAMARAN = 'pa_dev_catamaran';
// Dev only: inspect the scene and leave notes for Claude, and ?at= (inspect/, see docs/VOYAGE.md).
const InspectLayer = REVIEW ? lazy(() => import('./inspect/InspectTools')) : null;
const InspectControls = REVIEW ? lazy(() => import('./inspect/InspectTools').then(module => ({ default: module.InspectControls }))) : null;

export default function Garden() {
  const [paused, setPaused] = useState(false);
  const [reduced, setReduced] = useState(false);
  const [sceneOnly, setSceneOnly] = useState(false);
  const [lightTrees, setLightTrees] = useState(false);
  const [skyStyle, setSkyStyle] = useState<SkyStyle>(SKY_STYLE);
  const [groundStyle, setGroundStyle] = useState<GroundStyle>('natural');
  const [rockStyle, setRockStyle] = useState<RockStyle>('moss');
  const [plantStyle, setPlantStyle] = useState<PlantStyle>('varied');
  const [boatStyle, setBoatStyle] = useState<BoatLook>(BOAT_LOOK);
  // The year turning in the canopy, grass and light; the Review panel can turn it off (seasons.ts).
  const [seasons, setSeasons] = useState(SEASONS);
  // Far-off landscapes of where they were; the Review panel can turn them off (places.ts).
  const [places, setPlaces] = useState(PLACES);
  const [running, setRunning] = useState(false);
  const [ready, setReady] = useState(false);
  const [openingReleased, setOpeningReleased] = useState(false);
  const [prepared, setPrepared] = useState(false);
  const [failed, setFailed] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [slow, setSlow] = useState(false);
  // Dev only: seconds from navigation to the cover lifting, for comparing the Review's load choices.
  const [readyIn, setReadyIn] = useState<number | null>(null);
  // Dev only: the Review's load choices (loadChoices.ts), read after hydration as the page renders on the server.
  const [loadChoices, setLoadChoices] = useState<{ textures: TextureWeight; prepare: PrepareWhen } | null>(null);
  useEffect(() => { if (REVIEW) setLoadChoices({ textures: TEXTURE_WEIGHT, prepare: PREPARE }); }, []);
  const [boatLaunchRequest, setBoatLaunchRequest] = useState(0);
  const [showReview, setShowReview] = useState(REVIEW);
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
    if (REVIEW) {
      const water = localStorage.getItem(REVIEW_WATER);
      setSkyStyle({ sky: localStorage.getItem(REVIEW_SKY) === 'mist' ? 'mist' : 'day', water: water && water in WATERS ? water as WaterStyle : SKY_STYLE.water });
    }
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
    document.documentElement.dataset.gardenState = failed ? 'error' : ready ? 'ready' : 'loading';
    if (REVIEW && ready) setReadyIn(performance.now() / 1000);
  }, [ready, failed]);
  useEffect(() => {
    if (!ready || failed) return;
    const element = cover.current!;
    let timer: ReturnType<typeof setTimeout> | undefined;
    // Start the perch time after the cover's fade, including reduced-motion
    // styles. Listening, rather than checking its style every frame, saves a
    // style recalculation per frame while the butterflies move.
    const revealed = (event: TransitionEvent) => {
      if (event.target !== element || event.propertyName !== 'opacity') return;
      clearTimeout(timer);
      timer = setTimeout(() => setOpeningReleased(true), 1200);
    };
    element.addEventListener('transitionend', revealed);
    // In case the fade never reports finishing.
    timer = setTimeout(() => setOpeningReleased(true), 4000);
    return () => { element.removeEventListener('transitionend', revealed); clearTimeout(timer); };
  }, [ready, failed]);
  useEffect(() => {
    const query = matchMedia('(prefers-reduced-motion: reduce)');
    const updatePreference = () => setReduced(query.matches);
    updatePreference();
    query.addEventListener('change', updatePreference);
    return () => query.removeEventListener('change', updatePreference);
  }, []);
  const voyage = useVoyage(scroller, reduced);
  const { progress } = voyage;
  // The scroll cue goes for good once the guest has scrolled a little.
  const [explored, setExplored] = useState(false);
  useEffect(() => { if (progress > .01 && !explored) setExplored(true); }, [progress, explored]);
  const chapter = { arrival: 0, voyage: 1, dock: 2 }[voyage.chapter];
  // Once the scene is up, the opening names fly to their boats as the guest
  // scrolls (NameFlight.tsx); before it, without it, or under reduced
  // motion, the title fades as a whole. The butterflies let go of the names
  // as they start to move.
  const flight = ready && !failed && !reduced;
  const arrival = useRef<HTMLElement>(null);
  const butterflies = useGardenButterflies({ chapter, paused, disabled: reduced, sceneOnly, ready, away: flight && voyage.away });
  // Prepared early, the scene still waits for the opening flock to land on
  // the names before it starts behind the cover and fades in (loadChoices.ts),
  // so their flight isn't hitched by the scene's first frames.
  const revealable = PREPARE !== 'early' || butterflies.settled;
  useEffect(() => {
    if (!prepared || failed || !revealable) return;
    let cancelled = false, frame = 0;
    const hold = import.meta.env.DEV ? Number(new URLSearchParams(location.search).get('slow')) || 0 : 0;
    void document.fonts.ready.then(() => {
      if (cancelled) return;
      // The scene starts moving behind the cover first. Its first live frames
      // can be slow on phones, and a fade started then jumps in partway, so
      // wait for a few smooth frames (a second at most) before it begins.
      setRunning(true);
      const start = performance.now();
      let previous = 0, smooth = 0;
      const wait = (now: number) => {
        smooth = previous && now - previous < 50 ? smooth + 1 : 0;
        previous = now;
        if ((smooth >= 3 || now - start > 1000) && now >= hold) setReady(true);
        else frame = requestAnimationFrame(wait);
      };
      frame = requestAnimationFrame(wait);
    });
    return () => { cancelled = true; cancelAnimationFrame(frame); };
  }, [prepared, failed, revealable]);
  // The date stays on through the voyage panel's fade out.
  const [lastDate, setLastDate] = useState<string | null>(null);
  if (voyage.date && voyage.date !== lastDate) setLastDate(voyage.date);
  // The date label: digits for guests; the Review panel can trial the others.
  const [dateMode, setDateMode] = useState<DateLabelMode>(DEFAULT_DATE_LABEL);
  useEffect(() => { if (REVIEW) setDateMode(dateLabelMode(localStorage.getItem(REVIEW_DATE))); }, []);
  // Dev only: the Review panel's copy, in today's glow by default.
  const [text, setText] = useState<TextLook>('glow');
  useEffect(() => { if (REVIEW) setText(textLook(localStorage.getItem(REVIEW_TEXT))); }, []);
  useEffect(() => { if (REVIEW) setBoatStyle(boatLook(localStorage.getItem(REVIEW_DINGHY), localStorage.getItem(REVIEW_CATAMARAN))); }, []);
  useEffect(() => { if (REVIEW) setSeasons(seasonsOn(localStorage.getItem(REVIEW_SEASONS))); }, []);
  useEffect(() => { if (REVIEW) setPlaces(placesOn(localStorage.getItem(REVIEW_PLACES))); }, []);
  const { month, year } = shownDate(voyage.date ?? lastDate ?? '', dateMode);
  // Under reduced motion the scene shows each milestone's still, so the date shows its day too.
  const easedMonth = useCallback(() => storyMonth(reduced ? stillProgress(voyage.pace.progress) : voyage.pace.progress), [voyage.pace, reduced]);
  // Optional sound (soundChoices.ts), off by default: the Review panel's
  // choice while developing, remembered, and a speaker button for guests
  // once GUEST_SOUND is set. Either starts only from a tap, click or key.
  const [sound, setSound] = useState<SoundMode>('off');
  useEffect(() => { if (REVIEW) setSound(soundMode(localStorage.getItem(REVIEW_SOUND))); }, []);
  const easedProgress = useCallback(() => reduced ? stillProgress(voyage.pace.progress) : voyage.pace.progress, [voyage.pace, reduced]);
  const unlockSound = useSoundscape({ mode: sound, paused, reduced, ready: ready && !failed, progress: easedProgress });
  const chooseSound = (mode: SoundMode) => {
    if (mode !== 'off') unlockSound();
    if (REVIEW) localStorage.setItem(REVIEW_SOUND, mode);
    setSound(mode);
  };
  // The scene already eases between stops; native smooth scrolling would
  // introduce a second animation and delay the content on slower devices.
  const goToProgress = voyage.go;
  // "Our story" (StoryDialog): the link that opened it, while it is open.
  const [storyOpener, setStoryOpener] = useState<HTMLElement | null>(null);
  const openStory = (event: MouseEvent<HTMLElement>) => setStoryOpener(event.currentTarget);
  // While the sheet covers the scene, the scene holds its motion and draws
  // only on demand (after a resize, say), as the guest's "Pause motion" does,
  // to spare a phone's battery; the guest's own choice is left as it was.
  const reading = storyOpener !== null;
  const state = failed ? 'error' : ready ? 'ready' : 'loading';
  return <main ref={scroller} className={`garden-prototype ${sceneOnly ? 'garden-scene-only' : ''}`} data-state={state} data-text={text === 'glow' ? undefined : text} data-golden={REVIEW && inkTurnsWhite(progress) ? '' : undefined} aria-busy={state === 'loading'}>
    <div className="garden-stage">
      <div className={`garden-canvas ${prepared ? 'is-ready' : ''}`} aria-hidden="true">
        <CanvasFallback onError={onError}>
          {mounted && !failed && <GardenCanvas frameloop={!running ? 'never' : paused || reduced || reading ? 'demand' : 'always'} prepare={PREPARE !== 'butterflies' || butterflies.settled} progress={progress} pace={voyage.pace} paused={paused || reading} reduced={reduced} onReady={onReady} onError={onError} boatLaunchRequest={boatLaunchRequest} lightTrees={lightTrees} groundStyle={groundStyle} rockStyle={rockStyle} plantStyle={plantStyle} skyStyle={skyStyle} boatLook={boatStyle} seasons={seasons} places={places} arrival={flight ? arrival : undefined} />}
        </CanvasFallback>
      </div>
      <div className="garden-wash" aria-hidden="true" />
      {/* Beneath the opening text and butterflies, which stay put as it fades. */}
      <div ref={cover} className="garden-cover" inert={state === 'ready'}>
        <p className="garden-visually-hidden" role="status">{failed ? 'The garden couldn’t open. The details are just below.' : ready ? '' : 'Preparing the garden'}</p>
      </div>
    </div>
    <p className="garden-visually-hidden" role="status">{chapter === 1 && voyage.announced ? `${dateLabel(progressAt(voyage.announced.month))}. ${voyage.announced.description}` : ''}</p>
    {butterflies.visits.map(visit => <ReleasedButterfly key={visit.id} visit={visit} paused={paused}
      openingReleased={openingReleased && !failed} available={butterflies.validPerches.has(visit.perch.key)} onLand={butterflies.land} onRetire={butterflies.retire} />)}
    {/* The chrome sits in pinned layers inside the scroller, so a drag that starts on it still scrolls. */}
    <div className="garden-chrome-layer">
      <header className="garden-header garden-copy garden-chrome" inert={state !== 'ready'}>
        <button className="garden-monogram" onClick={REVIEW ? toggleReview : () => goToProgress(0, true)} aria-label={REVIEW ? 'Toggle the Review panel' : 'Back to the beginning'}><img src={`${BASE}logo.png`} alt="" width={284} height={192} draggable={false} /></button>
        <div className="garden-header-links">
          {GUEST_SOUND && <button className="garden-sound-toggle" aria-label="Sound" aria-pressed={sound !== 'off'}
            onClick={() => chooseSound(sound === 'off' ? GUEST_SOUND_MODE : 'off')}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M4 9.5h3.5L12 5.5v13l-4.5-4H4z" />
              {sound === 'off' ? <path d="m16 9.5 5 5m0-5-5 5" /> : <path d="M15.5 9a4.2 4.2 0 0 1 0 6M18 6.5a7.8 7.8 0 0 1 0 11" />}
            </svg>
          </button>}
          <button className={`garden-invitation-link ${STORY_LINK}`} aria-haspopup="dialog" onClick={openStory}>Our story</button>
          <a className="garden-invitation-link" href={`${BASE}details/`}>The details</a>
          <a className="garden-invitation-link" href={`${BASE}details/#rsvp`}>RSVP <span aria-hidden="true">↗</span></a>
        </div>
      </header>
    </div>

    <div className="garden-panels garden-copy">
      <section ref={arrival} className={`garden-panel garden-arrival ${chapter === 0 ? 'is-active' : ''} ${flight ? 'has-flight' : ''}`} inert={chapter !== 0 || sceneOnly} aria-hidden={chapter !== 0 || sceneOnly}>
        <h1><span className="garden-name" data-name="patrick"><b className="garden-perch">P</b>atrick</span> <span className="garden-amp">&</span> <span className="garden-name" data-name="amelia"><b className="garden-perch">A</b>melia</span></h1>
        <p className="garden-subtitle">the journey so far</p>
        {/* Out of flow, so neither link can move the text above. */}
        <div className="garden-arrival-actions">
          <a className={`garden-skip ${slow && state === 'loading' ? 'is-visible' : ''}`} href={`${BASE}details/`}>Skip to the details <span aria-hidden="true">→</span></a>
          <a className={`garden-button garden-details-fallback ${failed ? 'is-visible' : ''}`} href={`${BASE}details/`}>See the details <span aria-hidden="true">→</span></a>
          {/* While the scene is slow or has failed, the story can still be read. */}
          <button className={`garden-skip garden-arrival-story ${STORY_LINK} ${(slow && state === 'loading') || failed ? 'is-visible' : ''}`} aria-haspopup="dialog" onClick={openStory}>Read our story</button>
        </div>
      </section>

      {/* Wordless but for the date: the scenery tells the story. Screen readers
          hear each milestone instead, from the status line below. */}
      <section className={`garden-panel garden-voyage ${chapter === 1 ? 'is-active' : ''}`} inert={chapter !== 1 || sceneOnly} aria-hidden={chapter !== 1 || sceneOnly}>
        <h2 className="garden-visually-hidden">Our story</h2>
        <p className="garden-voyage-date" aria-hidden="true" data-mode={dateMode === 'full' ? undefined : dateMode}>
          {dateMode === 'digits' ? <DigitClock month={easedMonth} reduced={reduced} /> : <>
            {dateMode === 'full' && <Crossfade className="garden-voyage-month" value={month} />}
            <Crossfade className="garden-voyage-year" value={year} />
          </>}
        </p>
        {/* Glides on to the dock at an easy pace; while it does, it pauses the glide. */}
        <button className="garden-text-link garden-glide" onClick={voyage.glide}>
          {voyage.gliding ? <>Pause <span aria-hidden="true">‖</span></> : <>The next chapter <span aria-hidden="true">→</span></>}
        </button>
      </section>

      <section className={`garden-panel garden-celebrate ${chapter === 2 ? 'is-active' : ''}`} inert={chapter !== 2 || sceneOnly} aria-hidden={chapter !== 2 || sceneOnly}>
        <p className="garden-eyebrow">We’re getting married</p>
        <h2><b className="garden-perch">M</b>eet us<br /><em>in the garden.</em></h2>
        <p className="garden-venue">Jasper’s Berry · Berry, NSW</p>
        <p className="garden-eyebrow">Friday, 16 April 2027</p>
        <a className="garden-button" href={`${BASE}details/`}>The details &amp; RSVP <span aria-hidden="true">→</span></a>
      </section>
    </div>

    <div className="garden-chrome-layer">
      <div className="garden-bottom garden-copy garden-chrome" inert={state !== 'ready'}>
        {/* Dev only: test buttons. Guests tap the water for a boat. */}
        {REVIEW && <div className="garden-creature-actions">
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
        </div>}
        <button className={`garden-scroll-cue ${explored ? 'is-done' : ''}`} onClick={() => goToProgress(nextStop(progress))}>
          Wander with us
          <span className="garden-scroll-cue-how" aria-hidden="true"><span className="garden-scroll-cue-mouse">Scroll</span><span className="garden-scroll-cue-touch">Swipe up</span></span>
          <i aria-hidden="true" />
        </button>
      </div>
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
          <option value="natural">Natural</option><option value="original">Original</option><option value="leafy">Leafy</option><option value="meadow">Meadow</option>
        </select>
      </label>
      <label className="garden-material-selector">Rocks
        <select aria-label="Rock style" value={rockStyle} onChange={event => setRockStyle(event.target.value as RockStyle)}>
          <option value="original">Original</option><option value="moss">Mossy</option>
        </select>
      </label>
      <label className="garden-material-selector">Sky
        <select aria-label="Sky" value={skyStyle.sky} onChange={event => {
          localStorage.setItem(REVIEW_SKY, event.target.value);
          // Safari only reads the page colour for its bars at load.
          location.reload();
        }}>
          <option value="day">Clear day</option><option value="mist">Mist (old)</option>
        </select>
      </label>
      <label className="garden-material-selector">Water
        <select aria-label="Water colour" value={skyStyle.water} onChange={event => {
          localStorage.setItem(REVIEW_WATER, event.target.value);
          setSkyStyle({ ...skyStyle, water: event.target.value as WaterStyle });
        }}>
          {(Object.keys(WATERS) as WaterStyle[]).map(water => <option key={water} value={water}>{WATERS[water].label}</option>)}
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
      <button onClick={() => {
        localStorage.setItem(REVIEW_SEASONS, seasons ? 'off' : 'on');
        setSeasons(!seasons);
      }} aria-pressed={seasons} title={seasons ? 'Show the garden the same all year' : 'Turn the year in the canopy, grass and light'}>
        Seasons: {seasons ? 'On' : 'Off'}
      </button>
      <button onClick={() => {
        localStorage.setItem(REVIEW_PLACES, places ? 'off' : 'on');
        setPlaces(!places);
      }} aria-pressed={places} title={places ? 'Hide the far-off escarpment, heads and hills' : 'Show the far-off places they lived in on the horizon'}>
        Places: {places ? 'On' : 'Off'}
      </button>
      <button onClick={() => setPaused(!paused)} disabled={reduced} aria-pressed={paused || reduced}>
        {reduced ? 'Reduced motion' : paused ? 'Resume motion' : 'Pause motion'}
      </button>
      <button onClick={() => setSceneOnly(!sceneOnly)} aria-pressed={sceneOnly}>{sceneOnly ? 'Show invitation' : 'Scene only'}</button>
      <label className="garden-material-selector garden-text-selector">Text
        <select aria-label="Text over the scene" value={text} onChange={event => {
          const look = textLook(event.target.value);
          localStorage.setItem(REVIEW_TEXT, look);
          setText(look);
        }}>
          {Object.entries(TEXT_LOOKS).map(([look, label]) => <option key={look} value={look}>{label}</option>)}
        </select>
      </label>
      <label className="garden-material-selector">Boats
        <select aria-label="Boats before they join" value={boatStyle.dinghy} onChange={event => {
          const look = boatLook(event.target.value, boatStyle.catamaran);
          localStorage.setItem(REVIEW_DINGHY, look.dinghy);
          setBoatStyle(look);
        }}>
          {(Object.keys(DINGHY_LOOKS) as DinghyLook[]).map(look => <option key={look} value={look}>{DINGHY_LOOKS[look]}</option>)}
        </select>
      </label>
      <label className="garden-material-selector">Catamaran
        <select aria-label="Catamaran" value={boatStyle.catamaran} onChange={event => {
          const look = boatLook(boatStyle.dinghy, event.target.value);
          localStorage.setItem(REVIEW_CATAMARAN, look.catamaran);
          setBoatStyle(look);
        }}>
          {(Object.keys(CATAMARAN_LOOKS) as CatamaranLook[]).map(look => <option key={look} value={look}>{CATAMARAN_LOOKS[look]}</option>)}
        </select>
      </label>
      <label className="garden-material-selector">Date
        <select aria-label="Date label" value={dateMode} onChange={event => {
          const mode = dateLabelMode(event.target.value);
          localStorage.setItem(REVIEW_DATE, mode);
          setDateMode(mode);
        }}>
          {Object.entries(DATE_LABEL_MODES).map(([mode, label]) => <option key={mode} value={mode}>{label}</option>)}
        </select>
      </label>
      {loadChoices && <>
      <label className="garden-material-selector garden-load-selector">Textures
        <select aria-label="Texture downloads" value={loadChoices.textures} onChange={event => {
          localStorage.setItem(REVIEW_TEXTURES, event.target.value);
          location.reload();
        }}>
          {Object.entries(TEXTURE_WEIGHTS).map(([weight, label]) => <option key={weight} value={weight}>{label}</option>)}
        </select>
      </label>
      <label className="garden-material-selector garden-load-selector">Prepare
        <select aria-label="When the scene prepares" value={loadChoices.prepare} onChange={event => {
          localStorage.setItem(REVIEW_PREPARE, event.target.value);
          location.reload();
        }}>
          {Object.entries(PREPARE_WHEN).map(([when, label]) => <option key={when} value={when}>{label}</option>)}
        </select>
      </label>
      </>}
      <label className="garden-material-selector garden-sound-selector">Sound
        <select aria-label="Sound" value={sound} onChange={event => chooseSound(soundMode(event.target.value))}>
          {Object.entries(SOUND_MODES).map(([mode, label]) => <option key={mode} value={mode}>{label}</option>)}
        </select>
      </label>
      {readyIn !== null && <span className="garden-review-load">Loaded in {readyIn.toFixed(1)}s</span>}
      {InspectControls && <Suspense fallback={null}><InspectControls pace={voyage.pace} go={voyage.go} /></Suspense>}
    </aside>}
    {mounted && <StoryDialog opener={storyOpener} onClose={() => setStoryOpener(null)} onSee={state === 'ready' && !sceneOnly ? goToProgress : undefined} />}
    {InspectLayer && <Suspense fallback={null}><InspectLayer go={voyage.go} ready={ready} /></Suspense>}
    <div className="garden-scroll-space" />
  </main>;
}
