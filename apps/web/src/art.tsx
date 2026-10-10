import type { Player, Terrain, TileSymbol } from '@okiya/game';

// All art is drawn in code (PRD U1): a small scene per terrain, an emblem per symbol and a mark per
// player's token, each with its own shape, so colour is never the only signal. Colours are theme tokens.

const glyph = { 'aria-hidden': true, focusable: false, viewBox: '0 0 24 24' } as const;

/**
 * A terrain's scene, filling its tile behind the token: pines on a ridge, a sailboat on swells, a
 * snow-capped range or dunes with a cactus. Drawn in three tones of the terrain's ink (`--sa` the lit
 * face, `--sb` the shade, `--sc` the highlight, set per terrain in styles.css). Parts of each scene move
 * slowly inside the tile on a board (styles.css): swells and a boat, clouds over the peaks, swaying
 * pines, a pulsing sun with heat lines.
 */
export function TerrainScene({ terrain }: { terrain: Terrain }) {
  const props = { 'aria-hidden': true, focusable: false, viewBox: '0 0 64 64', preserveAspectRatio: 'xMidYMid slice', className: 'scene' } as const;
  const a = { fill: 'var(--sa)' };
  const b = { fill: 'var(--sb)' };
  const c = { fill: 'var(--sc)' };
  // A wave line two periods wide beyond the tile on each side, so sliding it one period (32) loops without a seam.
  const swell = (y: number) => `M-36 ${y}q8-6 16 0${'t16 0'.repeat(8)}V68H-36z`;
  switch (terrain) {
    case 'Forest':
      return (
        <svg {...props} data-shape="pines">
          <path d="M-4 46 14 30 24 41 38 26 52 39 68 32V68H-4z" style={c} opacity=".5" />
          <g className="sc-tree sc-tree-1" style={a}>
            <path d="M16 17 25 35H7zM16 27 27 47H5z" />
          </g>
          <g className="sc-tree sc-tree-2" style={a}>
            <path d="M42 11 54 34H30zM42 24 57 50H27z" />
          </g>
          <g className="sc-tree sc-tree-3" style={b}>
            <path d="M57 30 63 42H51zM57 38 64 52H50z" />
          </g>
          <path d="M40 50h4v8h-4zM14 46h4v8h-4z" style={b} />
          <path d="M-4 56Q32 47 68 56V68H-4z" style={b} />
        </svg>
      );
    case 'Water':
      return (
        <svg {...props} data-shape="waves">
          <g className="sc-boat">
            <path d="M29 10v26H14zM33 14v22h13z" style={c} />
            <path d="M12 38h38l-4 6H16z" style={b} />
          </g>
          <path className="sc-swell sc-swell-a" d={swell(44)} style={a} />
          <path className="sc-swell sc-swell-b" d={swell(54)} style={b} />
          <path d="M6 49q4-3 8 0M36 58q4-3 8 0" fill="none" stroke="var(--sc)" strokeWidth="1.6" strokeLinecap="round" />
        </svg>
      );
    case 'Mountain':
      return (
        <svg {...props} data-shape="peaks">
          <path d="M-4 58 20 24l14 22 10-15 24 27z" style={a} />
          <path d="M-6 68 26 16l32 52z" style={b} />
          <path d="M26 16 18.5 31 23 29l3 6 4-6 4.5 2z" style={c} />
          <path d="M26 16 40 40 32 68h-6z" fill="#000" opacity=".18" />
          <g className="sc-cloud sc-cloud-1" style={c}>
            <path d="M0 14q1-5 6-3 2-4 7 0 5-1 5 4z" opacity=".7" />
          </g>
          <g className="sc-cloud sc-cloud-2" style={c}>
            <path d="M0 26q1-4 5-2.5 2-3 6 0 4-1 4 3z" opacity=".5" />
          </g>
        </svg>
      );
    case 'Desert':
      return (
        <svg {...props} data-shape="dunes">
          <circle className="sc-sun" cx="48" cy="16" r="7" style={c} opacity=".85" />
          <path d="M-4 42Q20 28 40 40T68 36V68H-4z" style={a} />
          <path className="sc-heat" d="M6 30q5-3 10 0t10 0M36 26q5-3 10 0t10 0" fill="none" stroke="var(--sc)" strokeWidth="1.2" strokeLinecap="round" />
          <path d="M45 52V32a3 3 0 0 1 6 0v20zM45 42h-6v-6a3 3 0 0 1 6 0zM51 40h6v-7a3 3 0 0 0-6 0z" style={c} />
          <path d="M-4 54Q24 40 68 56V68H-4z" style={b} />
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
      <circle cx="12" cy="12" r="11" fill="var(--chip)" stroke={color} strokeWidth="1.6" />
      {mark}
    </svg>
  );
}

/** The mark on a player's token: a ring on Player 1's, a diamond on Player 2's (the bot's in a bot game). */
export function TokenMark({ player }: { player: Player }) {
  return (
    <svg {...glyph} className="token-mark" data-shape={player === 'A' ? 'ring' : 'diamond'}>
      {player === 'A' ? (
        <circle cx="12" cy="12" r="6.5" fill="none" stroke="currentColor" strokeWidth="3.6" />
      ) : (
        <path d="M12 3.5 20.5 12 12 20.5 3.5 12z" fill="none" stroke="currentColor" strokeWidth="3.6" strokeLinejoin="round" />
      )}
    </svg>
  );
}

/** A terrain's scene alone, as the picture of a Match card chip. */
export function TerrainThumb({ terrain }: { terrain: Terrain }) {
  return (
    <span className={`terrain-thumb tile-art terrain-${terrain.toLowerCase()}`} data-terrain={terrain} aria-hidden="true">
      <TerrainScene terrain={terrain} />
    </span>
  );
}

/** A whole tile as the board draws it: its terrain scene and its symbol emblem, at any size. */
export function TileArt({ terrain, symbol, className = '' }: { terrain: Terrain; symbol: TileSymbol; className?: string }) {
  return (
    <span className={`tile-art terrain-${terrain.toLowerCase()} ${className}`.trim()} data-terrain={terrain} data-symbol={symbol} aria-hidden="true">
      <TerrainScene terrain={terrain} />
      <span className="tile-symbol">
        <SymbolEmblem symbol={symbol} />
      </span>
    </span>
  );
}

export function MenuIcon() {
  return (
    <svg {...glyph} className="glyph">
      <path d="M4 7h16M4 12h16M4 17h16" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" />
    </svg>
  );
}
