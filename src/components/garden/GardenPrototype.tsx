// PROTOTYPE: does a bright, reflective garden work as the wedding's opening?
// One direction requested by the user; review controls expose motion and composition.
import { Component, Suspense, useCallback, useEffect, useRef, useState, type ReactNode, type CSSProperties } from 'react';
import { Canvas } from '@react-three/fiber';
import * as THREE from 'three';
import GardenScene from './GardenScene';
import './gardenPrototype.css';

const BASE = import.meta.env.BASE_URL;
const MEMORY_START = .20, MEMORY_END = .82;
const memories = [
  { file: '20191122_191734.jpg', caption: 'The early days.', alt: 'Patrick and Amelia with a friend beside the harbour' },
  { file: 'IMG_5509.jpg', caption: 'And then, this.', alt: 'Patrick and Amelia smiling together on a night out' },
  { file: 'IMG_7024.jpg', caption: 'The first trip away.', alt: 'Patrick and Amelia with hot-air balloons in the sky behind them' },
  { file: '944d7da37c56a0522ee21fd47b54a4b0.jpg', caption: 'Dressed up, somewhere with a view.', alt: 'Patrick and Amelia dressed up together at sunset' },
  { file: 'IMG_0466.jpg', caption: 'Us, being us.', alt: 'A playful close-up selfie of Patrick and Amelia' },
];

class CanvasFallback extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  render() { return this.state.failed ? <p className="garden-fallback">The garden is taking a little rest. Your invitation is below.</p> : this.props.children; }
}

export default function GardenPrototype() {
  const [progress, setProgress] = useState(0);
  const [paused, setPaused] = useState(false);
  const [reduced, setReduced] = useState(false);
  const [sceneOnly, setSceneOnly] = useState(false);
  const [ezTrees, setEzTrees] = useState(true);
  const [ready, setReady] = useState(false);
  const [boatLaunchRequest, setBoatLaunchRequest] = useState(0);
  const touchStart = useRef<{ x: number; y: number } | null>(null);
  const onReady = useCallback(() => setReady(true), []);
  useEffect(() => {
    const query = matchMedia('(prefers-reduced-motion: reduce)');
    const updatePreference = () => setReduced(query.matches);
    const update = () => setProgress(Math.min(1, window.scrollY / Math.max(1, document.documentElement.scrollHeight - innerHeight)));
    updatePreference(); update();
    query.addEventListener('change', updatePreference);
    window.addEventListener('scroll', update, { passive: true });
    window.addEventListener('resize', update);
    return () => {
      query.removeEventListener('change', updatePreference);
      window.removeEventListener('scroll', update); window.removeEventListener('resize', update);
    };
  }, []);
  const chapter = progress < MEMORY_START ? 0 : progress < MEMORY_END ? 1 : 2;
  const memoryIndex = Math.max(0, Math.min(memories.length - 1,
    Math.floor((progress - MEMORY_START) / (MEMORY_END - MEMORY_START) * memories.length)));
  const goToProgress = (next: number) => {
    setProgress(next);
    window.scrollTo({ top: (document.documentElement.scrollHeight - innerHeight) * next, behavior: 'instant' });
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
  return <main className={`garden-prototype ${sceneOnly ? 'garden-scene-only' : ''}`}>
    <div className={`garden-canvas ${ready ? 'is-ready' : ''}`} aria-hidden="true">
      <CanvasFallback>
        <Canvas shadows style={{ touchAction: 'pan-y pinch-zoom' }} frameloop={paused || reduced ? 'demand' : 'always'} dpr={[1, 1.25]} camera={{ position: [0, 3.2, 18], fov: 48, near: .2, far: 220 }}
          gl={{ antialias: true, powerPreference: 'high-performance', toneMapping: THREE.ACESFilmicToneMapping, toneMappingExposure: 1.05 }}>
          <Suspense fallback={null}>
            <GardenScene progress={progress} paused={paused} reduced={reduced} onReady={onReady} boatLaunchRequest={boatLaunchRequest} ezTrees={ezTrees} />
          </Suspense>
        </Canvas>
      </CanvasFallback>
    </div>
    <div className="garden-wash" aria-hidden="true" />
    <header className="garden-header garden-copy">
      <button className="garden-monogram" onClick={() => scrollToChapter(0)} aria-label="Back to the beginning">P<span>&</span>A</button>
      <span className="garden-header-date">16 APRIL 2027</span>
      <a className="garden-invitation-link" href={`${BASE}invitation/`}>Your invitation <span aria-hidden="true">↗</span></a>
    </header>

    <div className="garden-panels garden-copy">
      <section className={`garden-panel garden-arrival ${chapter === 0 ? 'is-active' : ''}`} inert={chapter !== 0 || sceneOnly} aria-hidden={chapter !== 0 || sceneOnly}>
        <p className="garden-eyebrow">Together with our favourite people</p>
        <h1>Patrick <span>&</span> Amelia</h1>
        <p className="garden-subtitle">A new chapter, together.</p>
        <div className="garden-date"><span>16 . 04 . 2027</span><i /><span>Jasper’s Berry</span></div>
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
                  <img src={`${BASE}photos/${memory.file}`} alt={offset === 0 && visible ? memory.alt : ''} decoding="async" draggable={false} />
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
          <h2>A lifetime of<br /><em>little moments.</em></h2>
          <p>And now, one more to share<br />with the people we love.</p>
          <button className="garden-text-link" onClick={() => scrollToChapter(2)}>The next chapter <span aria-hidden="true">→</span></button>
        </div>
      </section>

      <section className={`garden-panel garden-celebrate ${chapter === 2 ? 'is-active' : ''}`} inert={chapter !== 2 || sceneOnly} aria-hidden={chapter !== 2 || sceneOnly}>
        <p className="garden-eyebrow">We’re getting married</p>
        <h2>Meet us<br /><em>in the garden.</em></h2>
        <p className="garden-venue">Jasper’s Berry · Berry, NSW</p>
        <p className="garden-eyebrow">Friday, 16 April 2027</p>
        <a className="garden-button" href={`${BASE}invitation/`}>Open your invitation <span aria-hidden="true">↗</span></a>
      </section>
    </div>

    <nav className="garden-chapters garden-copy" aria-label="Garden chapters">
      {['The beginning', 'Our story', 'The celebration'].map((name, i) => <button key={name}
        onClick={() => scrollToChapter(i)} aria-label={name} aria-current={chapter === i ? 'step' : undefined}>
        <span className="garden-chapter-number">0{i + 1}</span><span className="garden-chapter-line" /><span className="garden-chapter-name">{name}</span>
      </button>)}
    </nav>
    <div className="garden-bottom garden-copy">
      <button className="garden-boat-launch" disabled={!ready} onClick={() => setBoatLaunchRequest(value => value + 1)} aria-label="Float a paper boat">
        <svg width="23" height="20" viewBox="0 0 28 24" fill="none" aria-hidden="true">
          <path d="m2 13 12 3 12-3-6 8H8L2 13Zm5 1 7-11 7 11M14 3v13" stroke="currentColor" strokeWidth="1" strokeLinejoin="round" />
        </svg>
        <span>Float a paper boat</span>
      </button>
      <button className="garden-scroll-cue" onClick={nextStop}>
        {chapter === 2 ? 'Back to the beginning' : 'Wander with us'} <span aria-hidden="true">{chapter === 2 ? '↑' : '↓'}</span>
      </button>
    </div>
    <aside className="garden-review" aria-label="Proof of concept controls">
      <span className="garden-study-label">Garden study <b>02</b></span>
      <span className="garden-review-divider" />
      <button onClick={() => setEzTrees(value => !value)} aria-pressed={ezTrees}
        aria-label="Use EZ-Tree trees" title={ezTrees ? 'Switch to original trees' : 'Switch to EZ-Tree trees'}>
        Trees: {ezTrees ? 'EZ-Tree' : 'Original'}
      </button>
      <button onClick={() => setPaused(!paused)} disabled={reduced} aria-pressed={paused || reduced}>
        {reduced ? 'Reduced motion' : paused ? 'Resume motion' : 'Pause motion'}
      </button>
      <button onClick={() => setSceneOnly(!sceneOnly)} aria-pressed={sceneOnly}>{sceneOnly ? 'Show invitation' : 'Scene only'}</button>
    </aside>
    <div className="garden-scroll-space" />
  </main>;
}
