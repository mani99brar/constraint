import type { FighterType, Terrain, TileSymbol } from '@okiya/rules';

// All art is drawn in code (PRD T6, U4): a small scene per terrain, an emblem per symbol and per
// fighter, each with its own shape, so colour is never the only signal. Colours are theme tokens.

const glyph = { 'aria-hidden': true, focusable: false, viewBox: '0 0 24 24' } as const;

/** A terrain's scene, filling its tile behind the token: pines, waves, peaks or dunes. */
export function TerrainScene({ terrain }: { terrain: Terrain }) {
  const ink = `var(--${terrain.toLowerCase()}-ink)`;
  const props = { 'aria-hidden': true, focusable: false, viewBox: '0 0 100 100', preserveAspectRatio: 'xMidYMid slice', className: 'scene' } as const;
  switch (terrain) {
    case 'Forest':
      return (
        <svg {...props} data-shape="pines">
          <path d="M0 82q25-12 50-4t50-6v28H0z" fill={ink} opacity="0.28" />
          {[
            [22, 30, 1],
            [78, 26, 0.9],
            [64, 48, 0.75],
          ].map(([x, y, s]) => (
            <g key={x} transform={`translate(${x} ${y}) scale(${s})`} fill={ink} opacity="0.62">
              <path d="M0-18 13 4H5l10 14H-15L-5 4h-8z" />
              <rect x="-2.5" y="18" width="5" height="9" />
            </g>
          ))}
        </svg>
      );
    case 'Water':
      return (
        <svg {...props} data-shape="waves">
          <g fill="none" stroke={ink} strokeWidth="3.2" strokeLinecap="round" opacity="0.55">
            <path d="M-4 22q8-7 16 0t16 0 16 0 16 0 16 0 16 0 16 0" />
            <path d="M-12 50q8-7 16 0t16 0 16 0 16 0 16 0 16 0 16 0" opacity="0.7" />
            <path d="M-4 78q8-7 16 0t16 0 16 0 16 0 16 0 16 0 16 0" />
          </g>
          <path d="M80 62a9 6 0 1 1-1-.2l-8 3z" fill={ink} opacity="0.5" />
        </svg>
      );
    case 'Mountain':
      return (
        <svg {...props} data-shape="peaks">
          <path d="M-6 92 30 30l18 28 14-20 44 54z" fill={ink} opacity="0.5" />
          <path d="M30 30 21 46l7-3 4 5 5-6zM62 38l-7 10 6-2 4 4 4-5z" fill="var(--surface)" opacity="0.85" />
        </svg>
      );
    case 'Desert':
      return (
        <svg {...props} data-shape="dunes">
          <path d="M-4 70q30-22 58-4t50-8v42H-4z" fill={ink} opacity="0.32" />
          <path d="M-4 88q34-16 62-2t46-4v18H-4z" fill={ink} opacity="0.45" />
          <g fill={ink} opacity="0.65" transform="translate(80 30)">
            <rect x="-3" y="0" width="6" height="30" rx="3" />
            <path d="M-3 16h-6a3 3 0 0 1-3-3V6a2.5 2.5 0 0 1 5 0v5h4zM3 12h5V4a2.5 2.5 0 0 1 5 0v8a4 4 0 0 1-4 4H3z" />
          </g>
        </svg>
      );
  }
}

/** A small terrain glyph for the top bar and How to Play. */
export function TerrainGlyph({ terrain }: { terrain: Terrain }) {
  const color = `var(--${terrain.toLowerCase()}-ink)`;
  switch (terrain) {
    case 'Forest':
      return (
        <svg {...glyph} className="glyph" data-shape="pines">
          <path d="M12 2 5 13h4l-4 6h14l-4-6h4z" fill={color} />
          <rect x="10.8" y="19" width="2.4" height="4" fill={color} />
        </svg>
      );
    case 'Water':
      return (
        <svg {...glyph} className="glyph" data-shape="waves">
          <path d="M2 8q2.5-3 5 0t5 0 5 0 5 0M2 14q2.5-3 5 0t5 0 5 0 5 0M2 20q2.5-3 5 0t5 0 5 0 5 0" fill="none" stroke={color} strokeWidth="2.2" />
        </svg>
      );
    case 'Mountain':
      return (
        <svg {...glyph} className="glyph" data-shape="peaks">
          <path d="M1 21 9 6l4 7 3-4 7 12z" fill={color} />
        </svg>
      );
    case 'Desert':
      return (
        <svg {...glyph} className="glyph" data-shape="dunes">
          <path d="M1 21q5-8 11-4t11-2v6z" fill={color} />
          <rect x="15" y="4" width="3" height="11" rx="1.5" fill={color} />
          <path d="M15 10h-2V7h-1.6v4a1.4 1.4 0 0 0 1.4 1.4H15z" fill={color} />
        </svg>
      );
  }
}

/** A symbol's emblem: a round badge with a sun, crescent, star or wave. */
export function SymbolEmblem({ symbol }: { symbol: TileSymbol }) {
  const color = `var(--${symbol.toLowerCase()})`;
  let mark;
  switch (symbol) {
    case 'Sun':
      mark = (
        <>
          <circle cx="12" cy="12" r="4.2" fill={color} />
          <path d="M12 3v3M12 18v3M3 12h3M18 12h3M5.6 5.6l2.1 2.1M16.3 16.3l2.1 2.1M5.6 18.4l2.1-2.1M16.3 7.7l2.1-2.1" stroke={color} strokeWidth="2" strokeLinecap="round" />
        </>
      );
      break;
    case 'Moon':
      mark = <path d="M14.5 4.2a8 8 0 1 0 5.6 11.4 6.4 6.4 0 0 1-5.6-11.4z" fill={color} />;
      break;
    case 'Star':
      mark = <path d="m12 3.5 2.5 5.3 5.8.7-4.3 4 1.1 5.8L12 16.4l-5.1 2.9L8 13.5l-4.3-4 5.8-.7z" fill={color} />;
      break;
    case 'Wave':
      mark = <path d="M3.5 14.5c2.5-6 6-6 8-2s5 5 6.8.7 2.8-2.2 2.8-2.2" fill="none" stroke={color} strokeWidth="2.6" strokeLinecap="round" />;
      break;
  }
  return (
    <svg {...glyph} className="emblem-svg" data-shape={symbol.toLowerCase()}>
      <circle cx="12" cy="12" r="11" fill="var(--chip)" stroke={color} strokeWidth="1.4" />
      {mark}
    </svg>
  );
}

/** Each fighter's emblem on its token: a portal, a push, a swap, chevrons, a lens, a magnet, an anchor, a weave, a jaw. */
export function FighterEmblem({ type }: { type: FighterType }) {
  const stroke = { fill: 'none', stroke: 'currentColor', strokeWidth: 2.2, strokeLinecap: 'round', strokeLinejoin: 'round' } as const;
  let mark;
  switch (type) {
    case 'Teleporter':
      mark = <path {...stroke} d="M12 3.5a8.5 8.5 0 1 1-8.5 8.5M12 7.5a4.5 4.5 0 1 0 4.5 4.5M12 11.2a.8.8 0 1 1-.8.8" />;
      break;
    case 'Pusher':
      mark = <path {...stroke} d="M4.5 5v14M8.5 12h11M15 7.5l4.5 4.5-4.5 4.5" />;
      break;
    case 'Swapper':
      mark = <path {...stroke} d="M4 8.5h15l-3.5-3.5M20 15.5H5l3.5 3.5" />;
      break;
    case 'Upgrader':
      mark = <path {...stroke} d="M6 13.5l6-6 6 6M6 19l6-6 6 6M12 2.5v3" />;
      break;
    case 'TrapChecker':
      mark = <path {...stroke} d="M10.5 4a6 6 0 1 1 0 12 6 6 0 0 1 0-12zM15 15l5.5 5.5" />;
      break;
    case 'Puller':
      mark = <path {...stroke} d="M6.5 4v8a5.5 5.5 0 0 0 11 0V4M4.5 4h4M15.5 4h4" />;
      break;
    case 'Anchor':
      mark = <path {...stroke} d="M12 7.2a2 2 0 1 1 0-4 2 2 0 0 1 0 4zM12 7.2V21M8 10.5h8M4.5 14a7.5 7 0 0 0 15 0" />;
      break;
    case 'TerrainWeaver':
      mark = <path {...stroke} d="M3 8.5c3-3 6 3 9 0s6-3 9 0M3 15.5c3-3 6 3 9 0s6-3 9 0M8 4v16M16 4v16" />;
      break;
    case 'Trapper':
      mark = <path {...stroke} d="M3 16.5h18M4 16.5l2-6 2 6 2-6 2 6 2-6 2 6 2-6 2 6M6 20.5h12" />;
      break;
  }
  return (
    <svg {...glyph} className="fighter-emblem" data-shape={type}>
      {mark}
    </svg>
  );
}

/** The back of a face-down token: a leaf in a ring, the same for every fighter. */
export function TokenBack() {
  return (
    <svg {...glyph} className="token-back-art">
      <circle cx="12" cy="12" r="7.5" fill="none" stroke="currentColor" strokeWidth="1.6" strokeDasharray="2 2.2" />
      <path d="M8 15.5c0-5 3-7.5 8-7.5 0 5-3 7.5-8 7.5zM8 15.5l4-4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

export function LockIcon() {
  return (
    <svg {...glyph} className="glyph">
      <rect x="4.5" y="10.5" width="15" height="11" rx="2" fill="currentColor" />
      <path d="M8 10.5V7.5a4 4 0 0 1 8 0v3" fill="none" stroke="currentColor" strokeWidth="2.5" />
    </svg>
  );
}

export function ShieldIcon() {
  return (
    <svg {...glyph} className="glyph">
      <path d="M12 1.5 3.5 5v6c0 6 3.8 9.6 8.5 11.5 4.7-1.9 8.5-5.5 8.5-11.5V5z" fill="currentColor" />
    </svg>
  );
}

export function TrapIcon() {
  return (
    <svg {...glyph} className="glyph">
      <path d="M3 18.5h18M4 18.5l2-7 2 7 2-7 2 7 2-7 2 7 2-7 2 7" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinejoin="round" />
    </svg>
  );
}

export function MenuIcon() {
  return (
    <svg {...glyph} className="glyph">
      <path d="M4 7h16M4 12h16M4 17h16" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" />
    </svg>
  );
}

/** The game's mark: four tiles forming the 2×2 square of the objective, each with a token. */
export function Logo({ size = 72 }: { size?: number }) {
  return (
    <svg aria-hidden focusable={false} viewBox="0 0 64 64" width={size} height={size} className="logo" data-testid="logo">
      <rect x="2" y="2" width="60" height="60" rx="12" fill="var(--frame)" />
      <rect x="8" y="8" width="23" height="23" rx="4" fill="var(--forest)" />
      <rect x="33" y="8" width="23" height="23" rx="4" fill="var(--water)" />
      <rect x="8" y="33" width="23" height="23" rx="4" fill="var(--mountain)" />
      <rect x="33" y="33" width="23" height="23" rx="4" fill="var(--desert)" />
      {[
        [19.5, 19.5],
        [44.5, 19.5],
        [19.5, 44.5],
        [44.5, 44.5],
      ].map(([x, y]) => (
        <circle key={`${x}-${y}`} cx={x} cy={y} r="6.5" fill="var(--own)" stroke="var(--own-rim)" strokeWidth="2" />
      ))}
    </svg>
  );
}
