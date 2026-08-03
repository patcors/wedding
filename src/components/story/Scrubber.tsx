import { useEffect, useState } from 'react';
import { BRAID_T } from './curves';
import { scrollState } from './scrollState';

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

  return (
    <div
      style={{
        position: 'fixed',
        left: 0,
        right: 0,
        bottom: 0,
        zIndex: 50,
        display: 'flex',
        gap: '0.75rem',
        alignItems: 'center',
        padding: '0.6rem 1rem',
        background: 'rgba(8,12,18,0.82)',
        backdropFilter: 'blur(6px)',
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
        style={{
          background: '#1e2936',
          border: '1px solid #33445a',
          color: '#e2e8f0',
          borderRadius: 4,
          padding: '0.25rem 0.6rem',
          cursor: 'pointer',
          font: 'inherit',
        }}
      >
        jump to braid
      </button>
    </div>
  );
}
