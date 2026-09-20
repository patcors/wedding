import { useId } from 'react';
import { BUTTERFLY_COLORS, type ButterflyColor } from './butterflyColors';
import './gardenButterfly.css';

export default function ButterflyArtwork({ color }: { color: ButterflyColor }) {
  const gradientId = useId();
  const palette = BUTTERFLY_COLORS[color];
  return (
      <svg className="garden-butterfly-shape" viewBox="0 0 100 100" fill="none">
        <defs>
          <linearGradient id={gradientId} x1="49" y1="58" x2="15" y2="20" gradientUnits="userSpaceOnUse">
            <stop stopColor={palette[0]} /><stop offset=".45" stopColor={palette[1]} /><stop offset=".78" stopColor={palette[2]} /><stop offset="1" stopColor={palette[3]} />
          </linearGradient>
        </defs>
        {[false, true].map(right => <g key={String(right)} transform={right ? 'translate(100 0) scale(-1 1)' : undefined}>
          <g className={`garden-butterfly-wing ${right ? 'is-right' : 'is-left'}`}>
            <path d="M49 49C39 27 18 6 5 10C0 21 7 43 16 51L49 58Z" fill="#101923" />
            <path d="M47 48C35 27 17 15 10 16C10 29 16 41 23 47L45 54Z" fill={`url(#${gradientId})`} />
            <g className="garden-butterfly-hindwing">
              <path d="M49 54L22 48C8 56 12 73 21 77L24 91L30 78C39 82 47 68 49 57Z" fill="#101923" />
              <path d="M45 56L24 52C17 59 19 69 26 72L29 80L33 72C39 73 44 65 45 56Z" fill={`url(#${gradientId})`} />
            </g>
            <path d="M46 51L17 26M44 49L25 22M44 57L25 65M43 60L32 72" stroke="#092b46" strokeOpacity=".45" strokeWidth=".7" />
            <path d="M16 57L18 60M18 66L20 68M35 74L37 72" stroke="#b4dcde" strokeOpacity=".7" strokeWidth="1.4" />
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
