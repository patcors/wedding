import { useEffect, useState } from 'react';
import { BRAID_T } from './curves';
import { scrollState } from './scrollState';
import {
  NORMAL_BYTES,
  cameraReadout,
  freeCamera,
  fuzzCount,
  fuzzStandoff,
  laidFill,
  laidFray,
  laidTurns,
  layAmp,
  layStrands,
  layTurns,
  normalDepth,
  normalStrength,
  ropeMode,
  useDebugValue,
  yarnScale,
  type NormalDepth,
  type RopeMode,
} from './debugStore';

const BUTTON: React.CSSProperties = {
  background: '#1e2936',
  border: '1px solid #33445a',
  color: '#e2e8f0',
  borderRadius: 4,
  padding: '0.25rem 0.6rem',
  cursor: 'pointer',
  font: 'inherit',
};

/** A labelled slider for one live-tuned number. */
function Knob({
  label,
  store,
  min,
  max,
  step,
}: {
  label: string;
  store: { get: () => number; set: (n: number) => void; subscribe: (l: () => void) => () => void };
  min: number;
  max: number;
  step: number;
}) {
  const value = useDebugValue(store);
  return (
    <label style={{ display: 'flex', gap: '0.35rem', alignItems: 'center' }}>
      <span style={{ opacity: 0.7 }}>{label}</span>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => store.set(parseFloat(e.target.value))}
        style={{ width: 70 }}
      />
      <span style={{ minWidth: '4ch' }}>{value.toFixed(2)}</span>
    </label>
  );
}

/**
 * Debug scrubber.
 *
 * The single highest-leverage tool in this project: iterating by dragging a
 * slider is roughly an order of magnitude faster than iterating by scrolling,
 * and it lets you park exactly on the braid while tuning it.
 *
 * Remove (or gate behind import.meta.env.DEV) before the site goes out.
 */
export function Scrubber() {
  const [active, setActive] = useState(false);
  const [value, setValue] = useState(0);
  const [readout, setReadout] = useState({ p: 0, v: 0 });
  const depth = useDebugValue(normalDepth);
  const rope = useDebugValue(ropeMode);
  const free = useDebugValue(freeCamera);
  const [cam, setCam] = useState('');

  useEffect(() => {
    scrollState.override = active ? value : null;
  }, [active, value]);

  useEffect(() => {
    const id = setInterval(
      () => setReadout({ p: scrollState.override ?? scrollState.progress, v: scrollState.velocity }),
      100,
    );
    return () => clearInterval(id);
  }, []);

  // Camera position, polled rather than subscribed: it changes every frame and
  // re-rendering the panel that often would be absurd. Formatted as an
  // argument list so a placement you like can be lifted straight into
  // cameraPositionAt / cameraTargetAt in curves.ts.
  useEffect(() => {
    if (!free) return;
    const id = setInterval(() => {
      const c = cameraReadout;
      const f = (n: number) => n.toFixed(1);
      setCam(`(${f(c.x)}, ${f(c.y)}, ${f(c.z)}) → (${f(c.tx)}, ${f(c.ty)}, ${f(c.tz)})`);
    }, 100);
    return () => clearInterval(id);
  }, [free]);

  return (
    <div
      style={{
        position: 'fixed',
        left: 0,
        right: 0,
        // Top, not bottom: Astro's own dev toolbar owns the bottom centre of
        // the viewport and the two overlap.
        top: 0,
        zIndex: 50,
        display: 'flex',
        gap: '0.75rem',
        alignItems: 'center',
        padding: '0.6rem 1rem',
        background: 'rgba(8,12,18,0.82)',
        backdropFilter: 'blur(6px)',
        borderBottom: '1px solid rgba(255,255,255,0.08)',
        color: '#e2e8f0',
        font: '500 12px ui-monospace, monospace',
      }}
    >
      <label style={{ display: 'flex', gap: '0.4rem', alignItems: 'center', cursor: 'pointer' }}>
        <input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} />
        scrub
      </label>

      <input
        type="range"
        min={0}
        max={1}
        step={0.0005}
        value={value}
        disabled={!active}
        onChange={(e) => setValue(parseFloat(e.target.value))}
        style={{ flex: 1, opacity: active ? 1 : 0.4 }}
      />

      <span style={{ minWidth: '13ch' }}>t {readout.p.toFixed(4)}</span>
      <span style={{ minWidth: '10ch' }}>vel {readout.v.toFixed(2)}</span>
      <button
        type="button"
        onClick={() => {
          setActive(true);
          setValue(BRAID_T);
        }}
        style={BUTTON}
      >
        jump to braid
      </button>

      {/* Takes the camera off the scroll curve. Drag to orbit, right-drag to
          pan, wheel to dolly — and note the wheel no longer scrolls the page
          while the pointer is over the canvas. Best used with `scrub` on, so
          the scene holds still while you move around it. */}
      <button
        type="button"
        onClick={() => freeCamera.set(!free)}
        title="Orbit: drag · pan: right-drag · dolly: wheel"
        style={{
          ...BUTTON,
          background: free ? '#3d5b7a' : '#1e2936',
          borderColor: free ? '#5b82ab' : '#33445a',
        }}
      >
        free cam
      </button>
      {free && (
        <span style={{ opacity: 0.7, whiteSpace: 'nowrap' }} title="camera → target">
          {cam}
        </span>
      )}

      <span style={{ opacity: 0.4 }}>│</span>
      {/* Which rope geometry. A/B this first — the knobs to its right differ. */}
      {(['tube', 'laid'] as RopeMode[]).map((m) => (
        <button
          key={m}
          type="button"
          onClick={() => ropeMode.set(m)}
          style={{
            ...BUTTON,
            background: rope === m ? '#3d5b7a' : '#1e2936',
            borderColor: rope === m ? '#5b82ab' : '#33445a',
          }}
        >
          {m}
        </button>
      ))}

      {rope === 'tube' ? (
        /* `lay` is the faked strand bulge; 0 is a plain round tube. */
        <>
          <Knob label="lay" store={layAmp} min={0} max={0.25} step={0.005} />
          <Knob label="str" store={layStrands} min={1} max={32} step={1} />
          <Knob label="trn" store={layTurns} min={20} max={520} step={10} />
        </>
      ) : (
        /* `trn` and `fil` are geometry — dragging them rebuilds the mesh and
           will hitch. `yrn` is just texture repeat, so it stays smooth. */
        <>
          <Knob label="trn" store={laidTurns} min={30} max={240} step={2} />
          <Knob label="fil" store={laidFill} min={0.8} max={1.25} step={0.01} />
          <Knob label="fry" store={laidFray} min={0} max={0.35} step={0.01} />
          <Knob label="fuz" store={fuzzCount} min={0} max={80000} step={2000} />
          <Knob label="out" store={fuzzStandoff} min={0} max={1} step={0.02} />
          <Knob label="yrn" store={yarnScale} min={1} max={4} step={1} />
        </>
      )}

      {/* normalScale — the fine-yarn shading depth. Wants to come down in
          `laid` mode: the geometry now carries the strand read the map was
          overdriven to fake. */}
      <Knob label="nrm" store={normalStrength} min={0} max={4} step={0.05} />

      {/* DEBUG: rope normal-map bit depth. Delete this block together with the
          marked section of debugStore.ts once 8-bit is confirmed. */}
      <span style={{ opacity: 0.4 }}>│</span>
      <span style={{ opacity: 0.7 }}>normal</span>
      {(['8', '16'] as NormalDepth[]).map((d) => (
        <button
          key={d}
          type="button"
          onClick={() => normalDepth.set(d)}
          title={`${(NORMAL_BYTES[d] / 1e6).toFixed(2)} MB over the wire`}
          style={{
            ...BUTTON,
            background: depth === d ? '#3d5b7a' : '#1e2936',
            borderColor: depth === d ? '#5b82ab' : '#33445a',
          }}
        >
          {d}-bit
        </button>
      ))}
      <span style={{ minWidth: '8ch', opacity: 0.7 }}>
        {(NORMAL_BYTES[depth] / 1e6).toFixed(2)} MB
      </span>
    </div>
  );
}
