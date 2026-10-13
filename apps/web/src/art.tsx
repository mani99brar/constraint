import type { Player, Terrain, TileSymbol } from '@okiya/game';

// All art is drawn in code (PRD U1): a small scene per terrain, a symbol printed into it and a mark per
// player's token, each with its own shape, so colour is never the only signal. Colours are theme tokens.

const glyph = { 'aria-hidden': true, focusable: false, viewBox: '0 0 24 24' } as const;

/**
 * A terrain's scene, filling its tile behind the token: pines on a ridge, a sailboat on swells, a
 * snow-capped range or dunes with a cactus. Drawn in three tones of the terrain's ink (`--sa` the lit
 * face, `--sb` the shade, `--sc` the highlight, set per terrain in styles.css). Each keeps the upper-left
 * square of 36 units (of 64) quiet, the tile's own colour only, because the tile's symbol is printed there
 * (SymbolMark), and a legal tile's moving symbol swells up to that edge; the shapes that name the terrain
 * sit low and to the right, and anything that drifts across the tile stays below it. Parts of each scene move slowly inside the tile
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
          <path d="M-4 52 12 44 24 48 40 36 52 41 68 34V68H-4z" style={c} opacity=".5" />
          <g className="sc-tree">
            <path d="M15 38 21 48H9zM15 43 23 55H7zM45 16 56 36H34zM45 27 59 50H31z" style={a} />
            <path d="M57 30 63 42H51zM57 38 64 52H50z" style={b} />
          </g>
          <path d="M43 50h4v8h-4zM13.5 55h3v3h-3z" style={b} />
          <path d="M-4 56Q32 47 68 56V68H-4z" style={b} />
        </svg>
      );
    case 'Water':
      return (
        <svg {...props} data-shape="waves">
          <g transform="translate(22 8) scale(.85)">
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
          <path d="M-4 62 14 42l12 12 30-28 12 12V68H-4z" style={a} />
          <path d="M14 76 46 26l32 50z" style={b} />
          <path d="M46 26 38.5 41 43 39l3 6 4-6 4.5 2z" style={c} />
          <path d="M46 26 60 50 52 76h-6z" fill="#000" opacity=".18" />
          <g className="sc-cloud sc-cloud-1" style={c}>
            <path d="M0 46q1-5 6-3 2-4 7 0 5-1 5 4z" opacity=".7" />
          </g>
          <g className="sc-cloud sc-cloud-2" style={c}>
            <path d="M0 57q1-4 5-2.5 2-3 6 0 4-1 4 3z" opacity=".5" />
          </g>
        </svg>
      );
    case 'Desert':
      return (
        <svg {...props} data-shape="dunes">
          <path d="M-4 44Q20 32 40 40T68 36V68H-4z" style={a} />
          <path className="sc-heat" d="M40 25q5-3 10 0t10 0M46 17q4-3 8 0t8 0" fill="none" stroke="var(--sc)" strokeWidth="1.2" strokeLinecap="round" />
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
 * behind it: a solid sun with six short rays, a broad crescent, a five-point star, or a breaking wave
 * with a round hollow under its lip. Shape alone tells them apart, in greyscale too. The shapes sit in
 * one group (symbol-ink) that moves on a board's legal tiles (styles.css) while the box keeps still. The
 * board variant is for a tile of about 40 px and up; the icon variant draws the same shapes bolder and
 * simpler for a thumbnail. Every place that shows a symbol draws it with this: the board, the home hero,
 * the Match card and How to Play.
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
      // A breaking wave: its back rises from the left to a crest that curls over to the right, the lip
      // hanging down over a round hollow, all on a rolling swell. Solid, so it carries the same weight as
      // the moon and the star; the board and the icon draw the same shape.
      mark = <path d="M1.2 21.2C4 22.6 7 22.6 10 21.6S16 20.6 19 21.6C20.6 22.1 22 22 23 21.4 23 20 21.6 19 19.6 19 15.8 19 12.6 16.9 12.6 13.2A3.9 3.9 0 0 1 20.2 11.8C20.3 13.8 21.5 15 22.5 14 23.4 12.6 23.5 10.6 23.3 8.8 22.9 5.2 20.2 2.8 16.8 2.8 12.6 2.8 9.8 5.8 8.6 9.4 7.4 13 5.4 18 1.8 18.7 0.7 18.9 0.5 20.6 1.2 21.2Z" {...soften} />;
      break;
  }
  return (
    <svg {...glyph} className="symbol-mark" data-shape={symbol.toLowerCase()} data-variant={variant} fill="currentColor">
      <g className="symbol-ink">{mark}</g>
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
