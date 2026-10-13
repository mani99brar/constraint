import type { Player, Terrain, TileSymbol } from '@okiya/game';

// All art is drawn in code (PRD U1): a small scene per terrain, a symbol printed into it and a mark per
// player's token, each with its own shape, so colour is never the only signal. Colours are theme tokens.

const glyph = { 'aria-hidden': true, focusable: false, viewBox: '0 0 24 24' } as const;

/**
 * A terrain's scene, filling its tile behind the token: pines on a ridge, a sailboat on swells, a
 * snow-capped range or dunes with a cactus. Drawn in three tones of the terrain's ink (`--sa` the lit
 * face, `--sb` the shade, `--sc` the highlight, set per terrain in styles.css). Each keeps its upper-left
 * corner quiet, the tile's own colour only, because the tile's symbol is printed there (SymbolMark); the
 * shapes that name the terrain sit low and to the right. Parts of each scene move slowly inside the tile
 * on a board (styles.css): swells and a boat, mist over the peaks, swaying pines, heat lines.
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
          <path d="M-4 50 12 40 24 45 38 28 52 39 68 32V68H-4z" style={c} opacity=".5" />
          <g className="sc-tree">
            <path d="M16 33 22 44H10zM16 39 24 52H8zM42 11 54 34H30zM42 24 57 50H27z" style={a} />
            <path d="M57 30 63 42H51zM57 38 64 52H50z" style={b} />
          </g>
          <path d="M40 50h4v8h-4zM14.5 52h3v4h-3z" style={b} />
          <path d="M-4 56Q32 47 68 56V68H-4z" style={b} />
        </svg>
      );
    case 'Water':
      return (
        <svg {...props} data-shape="waves">
          <g transform="translate(13 4)">
            <g className="sc-boat">
              <path d="M29 10v24H17zM33 14v20h12z" style={c} />
              <path d="M14 36h34l-4 6H18z" style={b} />
            </g>
          </g>
          <path className="sc-swell sc-swell-a" d={swell(44)} style={a} />
          <path className="sc-swell sc-swell-b" d={swell(54)} style={b} />
          <path d="M6 49q4-3 8 0M36 58q4-3 8 0" fill="none" stroke="var(--sc)" strokeWidth="1.6" strokeLinecap="round" />
        </svg>
      );
    case 'Mountain':
      return (
        <svg {...props} data-shape="peaks">
          <path d="M-4 60 16 36l12 14 28-30 12 12V68H-4z" style={a} />
          <path d="M8 68 40 18l32 50z" style={b} />
          <path d="M40 18 32.5 33 37 31l3 6 4-6 4.5 2z" style={c} />
          <path d="M40 18 54 42 46 68h-6z" fill="#000" opacity=".18" />
          <g className="sc-cloud sc-cloud-1" style={c}>
            <path d="M0 40q1-5 6-3 2-4 7 0 5-1 5 4z" opacity=".7" />
          </g>
          <g className="sc-cloud sc-cloud-2" style={c}>
            <path d="M0 52q1-4 5-2.5 2-3 6 0 4-1 4 3z" opacity=".5" />
          </g>
        </svg>
      );
    case 'Desert':
      return (
        <svg {...props} data-shape="dunes">
          <path d="M-4 44Q20 32 40 40T68 36V68H-4z" style={a} />
          <path className="sc-heat" d="M34 26q5-3 10 0t10 0M40 18q4-3 8 0t8 0" fill="none" stroke="var(--sc)" strokeWidth="1.2" strokeLinecap="round" />
          <path d="M45 52V32a3 3 0 0 1 6 0v20zM45 42h-6v-6a3 3 0 0 1 6 0zM51 40h6v-7a3 3 0 0 0-6 0z" style={c} />
          <path d="M-4 54Q24 40 68 56V68H-4z" style={b} />
        </svg>
      );
  }
}

/** Six blunt rays round a sun's disc, each a rounded bar turned about the centre. */
const rays = (width: number, from: number, length: number) =>
  [0, 60, 120, 180, 240, 300].map((angle) => <rect key={angle} x={12 - width / 2} y={from} width={width} height={length} rx={width / 2} transform={`rotate(${angle} 12 12)`} />);

/**
 * A symbol, printed into a tile's art in one ink (the theme's text colour, `currentColor`), with no badge
 * behind it: a solid sun with six short rays, a broad crescent, a five-point star, or one curling wave
 * crest with an open hollow. Shape alone tells them apart, in greyscale too. The board variant is for a
 * tile of about 40 px and up; the icon variant draws the same shapes bolder and simpler for a thumbnail.
 * Every place that shows a symbol draws it with this: the board, the home hero, the Match card and How
 * to Play.
 */
export function SymbolMark({ symbol, variant = 'board' }: { symbol: TileSymbol; variant?: 'board' | 'icon' }) {
  const icon = variant === 'icon';
  // A thin outline in the same ink rounds the star's and the crest's points.
  const soften = { stroke: 'currentColor', strokeWidth: icon ? 1.6 : 1.1, strokeLinejoin: 'round' } as const;
  let mark;
  switch (symbol) {
    case 'Sun':
      mark = icon ? (
        <>
          <circle cx="12" cy="12" r="6.2" />
          {rays(3.8, 0.8, 4.6)}
        </>
      ) : (
        <>
          <circle cx="12" cy="12" r="5.6" />
          {rays(3.2, 1.4, 4.2)}
        </>
      );
      break;
    case 'Moon':
      mark = <path d={icon ? 'M21.96 12.9A10 10 0 1 1 13.09 2.06A7 7 0 0 0 21.96 12.9z' : 'M21.21 14.33A9.5 9.5 0 1 1 11.75 2.5A7.6 7.6 0 0 0 21.21 14.33z'} />;
      break;
    case 'Star':
      mark = <path d={icon ? 'm12 1.8 3.2 6.4 7 .9-5.1 4.9 1.3 7L12 17.6 5.6 21l1.3-7L1.8 9.1l7-.9z' : 'm12 2.2 2.95 6.2 6.8.85-5 4.7 1.3 6.75L12 17.4l-6.05 3.3 1.3-6.75-5-4.7 6.8-.85z'} {...soften} />;
      break;
    case 'Wave':
      // The crest rises from the left, curls over to the right and hooks back, leaving a round hollow
      // under the curl; the icon drops the foot and keeps the curl.
      mark = (
        <path
          d={
            icon
              ? 'M2 21.5C5.5 21.5 6.6 17.6 7.4 13.6 8.6 7.6 12.2 2.6 17.4 2.6 20.8 2.6 23 5.3 23 8.6c0 3.1-2.4 5-4.9 4.6-2-.3-2.9-2.5-1.7-4-2.4.3-3.9 2.5-3.9 5.3 0 3 1.9 5.5 5.4 5.5H23v1.5z'
              : 'M1.5 21.5v-2.4c2.6 0 4-2.2 4.9-5.6C7.9 8 11.6 3 17.2 3 20.6 3 23 5.6 23 8.8c0 3-2.2 4.9-4.6 4.6-2-.3-2.8-2.4-1.7-3.9-2.5 0-4.3 2.1-4.3 4.9 0 2.6 1.8 4.7 4.6 4.7H23v2.4z'
          }
          {...soften}
        />
      );
      break;
  }
  return (
    <svg {...glyph} className="symbol-mark" data-shape={symbol.toLowerCase()} data-variant={variant} fill="currentColor">
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

/**
 * A whole tile as the board draws it: its terrain scene with its symbol printed in the upper-left corner,
 * at any size. Small pictures (the home hero's, How to Play's diagrams) take the icon variant.
 */
export function TileArt({ terrain, symbol, className = '', variant = 'board' }: { terrain: Terrain; symbol: TileSymbol; className?: string; variant?: 'board' | 'icon' }) {
  return (
    <span className={`tile-art terrain-${terrain.toLowerCase()} ${className}`.trim()} data-terrain={terrain} data-symbol={symbol} aria-hidden="true">
      <TerrainScene terrain={terrain} />
      <span className="tile-symbol">
        <SymbolMark symbol={symbol} variant={variant} />
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
