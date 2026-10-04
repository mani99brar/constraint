import { ALL_CELLS, legalTakes, take, type CellId, type GameState, type Player, type Terrain, type Tile, type TileSymbol } from '@okiya/game';
import { readText, writeJson, type KeyValueStorage } from './storage';
import { TITLE } from './title';

/** The `localStorage` key that remembers the How to Play dialog was seen once (PRD E2). */
export const HOWTO_SEEN_KEY = 'okiya.howto.seen';
/** The playtest build's guide dismissal, honoured so its players are not shown the dialog again. */
const LEGACY_GUIDE_KEY = 'okiya.guide.dismissed';

/** Whether the dialog opens by itself: only on the very first visit, and never when storage fails. */
export function howToOpensFirst(storage: KeyValueStorage | null): boolean {
  if (!storage) return false;
  return readText(storage, HOWTO_SEEN_KEY) !== 'true' && readText(storage, LEGACY_GUIDE_KEY) !== 'true';
}

export function rememberHowToSeen(storage: KeyValueStorage | null): boolean {
  return writeJson(storage, HOWTO_SEEN_KEY, true);
}

const T = (terrain: Terrain, symbol: TileSymbol): Tile => ({ terrain, symbol });

/**
 * The board every diagram is drawn on: one tile of each terrain and symbol, laid out once by hand,
 * row A first. The diagrams are real games on it, so they always agree with the rules.
 */
export const DIAGRAM_BOARD: readonly Tile[] = [
  T('Forest', 'Sun'), T('Water', 'Moon'), T('Mountain', 'Star'), T('Desert', 'Wave'),
  T('Mountain', 'Wave'), T('Desert', 'Star'), T('Forest', 'Moon'), T('Water', 'Sun'),
  T('Water', 'Star'), T('Forest', 'Wave'), T('Desert', 'Sun'), T('Mountain', 'Moon'),
  T('Desert', 'Moon'), T('Mountain', 'Sun'), T('Water', 'Wave'), T('Forest', 'Star'),
];

/** The empty diagram board with Player 1 to start. */
export const DIAGRAM_START: GameState = {
  seed: 0,
  board: DIAGRAM_BOARD,
  tokens: ALL_CELLS.map(() => null),
  starter: 'A',
  toMove: 'A',
  lastTile: null,
  takes: [],
  result: null,
};

/** How a cell of a small board diagram is drawn: its tile, or a token, with a mark. */
export interface DiagramCell {
  readonly cell: CellId;
  readonly tile: Tile;
  readonly token: Player | null;
  /** `glow` a tile that may be taken, `shape` part of a winning shape, `last` the last take, `dead` a tile that does not match. */
  readonly mark: 'glow' | 'shape' | 'last' | 'dead' | null;
}

export interface Diagram {
  readonly id: 'matching' | 'opening' | 'line' | 'square' | 'blockade' | 'draw';
  readonly caption: string;
  /** The takes of a real game on `DIAGRAM_BOARD`, Player 1 starting. */
  readonly takes: readonly CellId[];
}

/** The small board diagrams of How to Play; `howto.test.ts` replays each with the engine. */
export const DIAGRAMS = {
  matching: {
    id: 'matching',
    caption: 'The last take was Forest–Star. The glowing tiles share Forest or Star; the others cannot be taken.',
    takes: ['A1', 'B3', 'D4'],
  },
  opening: { id: 'opening', caption: 'The first take: any of the 12 edge tiles.', takes: [] },
  line: { id: 'line', caption: 'A line: a row, a column or a long diagonal, like this one.', takes: ['A1', 'B3', 'D4', 'A3', 'B2', 'A4', 'C3'] },
  square: { id: 'square', caption: 'A square: any 2×2 block of the board.', takes: ['A1', 'B3', 'A2', 'C1', 'B2', 'A3', 'B1'] },
  blockade: {
    id: 'blockade',
    caption: 'Player 1 took Forest–Wave at C2. None of the three tiles left matches it, so Player 2 cannot take one and Player 1 wins.',
    takes: ['A1', 'B3', 'C4', 'A2', 'D1', 'A4', 'B2', 'C1', 'D3', 'B1', 'A3', 'D4', 'C2'],
  },
  draw: {
    id: 'draw',
    caption: 'A full board with no line and no square: a draw.',
    takes: ['A1', 'C2', 'D3', 'A4', 'B1', 'C4', 'A2', 'D1', 'B3', 'D4', 'C1', 'B2', 'A3', 'D2', 'B4', 'C3'],
  },
} as const satisfies Record<string, Diagram>;

/** Whose tiles glow in a diagram: the player to move in its position, whose colour they take (PRD R2). */
export function diagramMover(diagram: Diagram): Player {
  return diagramState(diagram).toMove;
}

/** The state a diagram shows: its takes played on the diagram board. Throws on an illegal take, which the tests rule out. */
export function diagramState(diagram: Diagram): GameState {
  let state = DIAGRAM_START;
  for (const cell of diagram.takes) {
    const taken = take(state, cell);
    if (!taken.ok) throw new Error(`diagram ${diagram.id}: ${cell} is refused (${taken.refusal.code})`);
    state = taken.state;
  }
  return state;
}

/** Every cell of a diagram as drawn: the tile or token, the glowing legal takes, the winning shape, the last take and dead tiles. */
export function diagramCells(diagram: Diagram): DiagramCell[] {
  const state = diagramState(diagram);
  const legal = new Set(legalTakes(state));
  const { result } = state;
  const shape = new Set(result?.kind === 'win' && result.by !== 'blockade' ? result.cells : []);
  const blockade = result?.kind === 'win' && result.by === 'blockade';
  const last = state.takes[state.takes.length - 1];
  return ALL_CELLS.map((cell, index) => {
    const token = state.tokens[index] ?? null;
    let mark: DiagramCell['mark'] = null;
    if (shape.has(cell)) mark = 'shape';
    else if (legal.has(cell)) mark = 'glow';
    else if (token === null && (blockade || diagram.id === 'matching')) mark = 'dead';
    else if (blockade && cell === last) mark = 'last';
    return { cell, tile: DIAGRAM_BOARD[index]!, token, mark };
  });
}

export interface HowToPage {
  readonly id: 'taking' | 'opening' | 'shapes' | 'blockade' | 'draw';
  readonly title: string;
  readonly paragraphs: readonly string[];
  readonly diagrams: readonly Diagram[];
}

/**
 * How to Play (PRD E2): short pages on taking a matching tile, the edge opening, the line and square
 * shapes, the blockade and the full-board draw, each with diagrams drawn with the tile art. The
 * wording fits a game against the bot and a game between two players alike.
 */
export function howToPages(): HowToPage[] {
  return [
    {
      id: 'taking',
      title: 'Take a matching tile',
      paragraphs: [
        `${TITLE} is played by two sides on a 4×4 board of 16 tiles, each showing a terrain and a symbol. Take turns taking one tile; a token of yours goes on its cell.`,
        'The tile just taken is shown in the Match card. The next take must have the same terrain or the same symbol, from anywhere on the board. With highlights on, the tiles you may take glow in your colour.',
      ],
      diagrams: [DIAGRAMS.matching],
    },
    {
      id: 'opening',
      title: 'The first take',
      paragraphs: ['There is nothing to match yet, so the first take may be any tile on the edge of the board. The first game’s starter is chosen at random; after that, the starter alternates.'],
      diagrams: [DIAGRAMS.opening],
    },
    {
      id: 'shapes',
      title: 'Lines and squares',
      paragraphs: ['Each side has 8 tokens. Four of yours in a row, a column or a long diagonal, or filling a 2×2 square, win at once.'],
      diagrams: [DIAGRAMS.line, DIAGRAMS.square],
    },
    {
      id: 'blockade',
      title: 'Blockade',
      paragraphs: ['When no tile left on the board matches the last tile, the next side cannot take one and loses. Leaving your opponent without a matching tile is the heart of the game.'],
      diagrams: [DIAGRAMS.blockade],
    },
    {
      id: 'draw',
      title: 'Full board',
      paragraphs: ['When all 16 cells hold tokens and nobody has made a line or a square, the game is a draw.'],
      diagrams: [DIAGRAMS.draw],
    },
  ];
}

/** Example tiles for the matching illustration, against the last tile Forest–Moon. */
export const MATCHING_EXAMPLE: {
  readonly lastTile: Tile;
  readonly tiles: readonly (Tile & { readonly matches: boolean; readonly why: string })[];
} = {
  lastTile: { terrain: 'Forest', symbol: 'Moon' },
  tiles: [
    { terrain: 'Forest', symbol: 'Sun', matches: true, why: 'same terrain' },
    { terrain: 'Water', symbol: 'Moon', matches: true, why: 'same symbol' },
    { terrain: 'Desert', symbol: 'Star', matches: false, why: 'neither' },
  ],
};
