// PROTOTYPE: does a bright, reflective garden work as the wedding's opening?
// One direction requested by the user; review controls expose motion and composition.
import { Component, Suspense, useCallback, useEffect, useState, type ReactNode } from 'react';
import { Canvas } from '@react-three/fiber';
import * as THREE from 'three';
import GardenScene from './GardenScene';
import './gardenPrototype.css';

const BASE = import.meta.env.BASE_URL;

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
  const [ready, setReady] = useState(false);
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
  const chapter = progress < .30 ? 0 : progress < .72 ? 1 : 2;
  const scrollToChapter = (index: number) => {
    const next = [0, .49, 1][index];
    setProgress(next);
    // The camera already eases between chapters; native smooth scrolling would
    // introduce a second animation and delay the content on slower devices.
    window.scrollTo({ top: (document.documentElement.scrollHeight - innerHeight) * next, behavior: 'instant' });
  };
  return <main className={`garden-prototype ${sceneOnly ? 'garden-scene-only' : ''}`}>
    <div className={`garden-canvas ${ready ? 'is-ready' : ''}`} aria-hidden="true">
      <CanvasFallback>
        <Canvas shadows frameloop={paused || reduced ? 'demand' : 'always'} dpr={[1, 1.5]} camera={{ position: [0, 3.2, 18], fov: 48, near: .2, far: 220 }}
          gl={{ antialias: true, powerPreference: 'high-performance', toneMapping: THREE.ACESFilmicToneMapping, toneMappingExposure: 1.05 }}>
          <Suspense fallback={null}>
            <GardenScene progress={progress} paused={paused} reduced={reduced} onReady={onReady} />
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
        <figure>
          <img src={`${BASE}photos/IMG_5509.jpg`} alt="A photograph from Patrick and Amelia’s story" />
          <figcaption>Us, along the way.</figcaption>
        </figure>
        <div>
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
      <span className="garden-place">BERRY, NEW SOUTH WALES</span>
      <button className="garden-scroll-cue" onClick={() => scrollToChapter(chapter === 2 ? 0 : chapter + 1)}>
        {chapter === 2 ? 'Back to the beginning' : 'Wander with us'} <span aria-hidden="true">{chapter === 2 ? '↑' : '↓'}</span>
      </button>
    </div>
    <aside className="garden-review" aria-label="Proof of concept controls">
      <span className="garden-study-label">Garden study <b>01</b></span>
      <span className="garden-review-divider" />
      <button onClick={() => setPaused(!paused)} disabled={reduced} aria-pressed={paused || reduced}>
        {reduced ? 'Reduced motion' : paused ? 'Resume motion' : 'Pause motion'}
      </button>
      <button onClick={() => setSceneOnly(!sceneOnly)} aria-pressed={sceneOnly}>{sceneOnly ? 'Show invitation' : 'Scene only'}</button>
    </aside>
    <div className="garden-scroll-space" />
  </main>;
}
