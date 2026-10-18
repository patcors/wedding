import { useId } from 'react';
import { BUTTERFLY_COLORS, type ButterflyColor } from './butterflyColors';
import { WING } from './butterflyWing';
import './gardenButterfly.css';

export default function ButterflyArtwork({ color }: { color: ButterflyColor }) {
  const gradientId = useId();
  const palette = BUTTERFLY_COLORS[color];
  return (
      <svg className="garden-butterfly-shape" viewBox="0 0 100 100" fill="none">
        <defs>
          <linearGradient id={gradientId} x1={WING.gradient.from[0]} y1={WING.gradient.from[1]} x2={WING.gradient.to[0]} y2={WING.gradient.to[1]} gradientUnits="userSpaceOnUse">
            {WING.gradient.stops.map((offset, i) => <stop key={offset} offset={offset} stopColor={palette[i]} />)}
          </linearGradient>
        </defs>
        {[false, true].map(right => <g key={String(right)} transform={right ? 'translate(100 0) scale(-1 1)' : undefined}>
          <g className={`garden-butterfly-wing ${right ? 'is-right' : 'is-left'}`}>
            <path d={WING.forewing.edge} fill={WING.edgeColour} />
            <path d={WING.forewing.fill} fill={`url(#${gradientId})`} />
            <g className="garden-butterfly-hindwing">
              <path d={WING.hindwing.edge} fill={WING.edgeColour} />
              <path d={WING.hindwing.fill} fill={`url(#${gradientId})`} />
            </g>
            <path d={WING.veins} stroke={WING.veinColour} strokeOpacity=".45" strokeWidth=".7" />
            <path d={WING.spots} stroke={WING.spotColour} strokeOpacity=".7" strokeWidth="1.4" />
          </g>
        </g>)}
        <path d="M48 58L43 64L40 65M52 58L57 64L60 65M48 51L43 54M52 51L57 54" stroke="#172331" strokeWidth="1" strokeLinecap="round" />
        <ellipse className="garden-butterfly-abdomen" cx="50" cy="55" rx="2" ry="14" fill="#111e2a" />
        <ellipse cx="50" cy="45" rx="3" ry="5" fill="#233743" />
        <circle cx="50" cy="39" r="2.7" fill="#111e2a" />
        <path d="M49 38Q45 29 42 30M51 38Q55 29 58 30" stroke="#182734" strokeWidth="1" strokeLinecap="round" />
      </svg>
  );
}
