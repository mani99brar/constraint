/// <reference lib="dom" />
// The DOM library types the callbacks that run in the page (addInitScript, evaluate).
import { expect, type Page, type TestInfo } from '@playwright/test';
import { gameLogOf, legalTakes, newGame, take, type CellId, type GameState, type Player } from '@okiya/game';
import { PALETTE_IDS, type PaletteId } from '../../apps/web/src/theme';

/** The bot's reply may take up to 10 seconds with the real bot (decisions), after its short pause. */
export const BOT_REPLY_MS = 11_000;

export async function attachScreenshot(page: Page, testInfo: TestInfo, id: string) {
  const path = testInfo.outputPath(`${id}.png`);
  await page.screenshot({ path, fullPage: true });
  await testInfo.attach(`screenshot:${id}`, { path, contentType: 'image/png' });
}

/** The first value of the mulberry32 generator `fixRandomness` puts in the page. */
function firstRandomValue(initial: number): number {
  const state = (initial + 0x6d2b79f5) >>> 0;
  let t = state;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return (t ^ (t >>> 14)) >>> 0;
}

/**
 * The smallest randomness for `fixRandomness` whose first game is started by `starter`: the page's
 * first random value is the game's seed (`generateSeed`), and the seed chooses the first starter.
 */
export function randomnessWhere(starter: Player): number {
  for (let initial = 1; ; initial += 1) if (newGame({ seed: firstRandomValue(initial) >>> 1 }).starter === starter) return initial;
}

/** Randomness under which the human (A) starts the first game, and under which the bot (B) does. */
export const HUMAN_STARTS = randomnessWhere('A');
export const BOT_STARTS = randomnessWhere('B');

/**
 * Replaces the page's `crypto.getRandomValues` with a seeded generator (mulberry32) before any
 * script runs, so every game's seed, and with it the first starter, is fixed by the test, never by
 * an app parameter.
 */
export async function fixRandomness(page: Page, seed: number) {
  await page.addInitScript((initial: number) => {
    let state = initial >>> 0;
    const next = () => {
      state = (state + 0x6d2b79f5) >>> 0;
      let t = state;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return (t ^ (t >>> 14)) >>> 0;
    };
    Object.defineProperty(window.crypto, 'getRandomValues', {
      configurable: true,
      value: <T extends ArrayBufferView | null>(array: T): T => {
        if (array instanceof Uint32Array) {
          for (let i = 0; i < array.length; i += 1) array[i] = next();
        } else if (array) {
          const bytes = new Uint8Array(array.buffer, array.byteOffset, array.byteLength);
          for (let i = 0; i < bytes.length; i += 1) bytes[i] = next() & 0xff;
        }
        return array;
      },
    });
  }, seed);
  await skipStartCountdown(page);
}

/**
 * Turns the countdown before a new game off for a test, unless the stored settings already say otherwise
 * (a test that checks the countdown saves it on). Every page load reads it, so it holds across reloads.
 */
export async function skipStartCountdown(page: Page) {
  await page.addInitScript(() => {
    try {
      const stored = JSON.parse(window.localStorage.getItem('okiya.settings') ?? '{}') as Record<string, unknown>;
      // The scenarios were written against the classic Walnut look, so they keep it unless a test chooses a theme.
      if (!('countdown' in stored)) window.localStorage.setItem('okiya.settings', JSON.stringify({ palette: 'walnut', ...stored, countdown: false }));
    } catch {
      window.localStorage.setItem('okiya.settings', JSON.stringify({ palette: 'walnut', countdown: false }));
    }
  });
}

/** Marks How to Play as already seen, so it does not open by itself on the first visit. */
export async function skipFirstVisitHowTo(page: Page) {
  await page.addInitScript(() => window.localStorage.setItem('okiya.howto.seen', 'true'));
}

/** Opens the home screen with fixed randomness and How to Play already seen. */
export async function openHome(page: Page, seed: number = HUMAN_STARTS) {
  await fixRandomness(page, seed);
  await skipFirstVisitHowTo(page);
  await page.goto('/');
  await expect(page.getByTestId('home-screen')).toBeVisible();
}

/** The home screen's difficulty switch, on the page only while the bot is chosen. */
export const difficultySwitch = (page: Page) => page.getByTestId('difficulty-switch');
/** The home screen's Opponent switch. */
export const opponentSwitch = (page: Page) => page.getByTestId('opponent-switch');
/** The play panel's one Play button. */
export const playButton = (page: Page) => page.getByTestId('play');

/** From the home screen: chooses the bot as the opponent. */
export async function chooseBot(page: Page) {
  await opponentSwitch(page).getByRole('radio', { name: 'Bot' }).click();
  await expect(difficultySwitch(page)).toBeVisible();
}

/**
 * From the home screen: the bot at a difficulty (never Hard in tests) on the play panel, then one tap on
 * its Play; the board appears.
 */
export async function chooseDifficulty(page: Page, difficulty: 'Easy' | 'Normal' = 'Easy') {
  await chooseBot(page);
  await difficultySwitch(page).getByRole('radio', { name: difficulty }).click();
  await expect(difficultySwitch(page).getByRole('radio', { name: difficulty })).toHaveAttribute('aria-checked', 'true');
  await expect(playButton(page)).toHaveText(`Play · ${difficulty} bot`);
  await playButton(page).click();
  await expect(board(page)).toBeVisible();
  await expect(page.getByTestId('match-screen')).toHaveAttribute('data-mode', 'bot');
}

/** From the home screen: a friend as the opponent, then one tap on Play; the board appears at once. */
export async function chooseTwoPlayers(page: Page) {
  await opponentSwitch(page).getByRole('radio', { name: 'Friend' }).click();
  await expect(playButton(page)).toHaveText('Play · with a friend');
  await playButton(page).click();
  await expect(board(page)).toBeVisible();
  await expect(page.getByTestId('match-screen')).toHaveAttribute('data-mode', 'two-player');
}

/** Opens the home screen and starts a bot game, by default with the human starting against Easy. */
export async function startGame(page: Page, { seed = HUMAN_STARTS, difficulty = 'Easy' }: { seed?: number; difficulty?: 'Easy' | 'Normal' } = {}) {
  await openHome(page, seed);
  await chooseDifficulty(page, difficulty);
}

/** Opens the home screen and starts a two-player game, by default with Player 1 starting. */
export async function startTwoPlayerGame(page: Page, { seed = HUMAN_STARTS }: { seed?: number } = {}) {
  await openHome(page, seed);
  await chooseTwoPlayers(page);
}

export type Ending = 'shape' | 'blockade' | 'draw';

/**
 * A real game one take before it ends, with the player to move making the ending take: a win by a line
 * or a square (`shape`), a blockade or the full-board draw, for `mover` (a draw for whoever is to move).
 * Found by deterministic playouts with the engine; `ends` lists the takes that end it, and no other take
 * would end it another way, so a bot that takes an immediate win still ends it the wanted way.
 */
export function nearEnding(ending: Ending, mover: Player = 'B'): { state: GameState; ends: CellId[] } {
  const kind = (state: GameState): Ending | null => {
    const { result } = state;
    if (!result) return null;
    if (result.kind === 'draw') return 'draw';
    return result.by === 'blockade' ? 'blockade' : 'shape';
  };
  for (let seed = 1; seed < 20_000; seed += 1) {
    for (const stride of [5, 3]) {
      let state = newGame({ seed, starter: 'A' });
      while (!state.result) {
        const legal = legalTakes(state);
        if ((ending === 'draw' || state.toMove === mover) && state.takes.length >= 6) {
          const outcomes = legal.map((cell) => {
            const next = take(state, cell);
            return { cell, kind: next.ok ? kind(next.state) : null };
          });
          const ends = outcomes.filter((outcome) => outcome.kind === ending).map((outcome) => outcome.cell);
          // Every ending take ends the game the wanted way, so a bot with a choice still ends it so.
          if (ends.length > 0 && outcomes.every((outcome) => outcome.kind === null || outcome.kind === ending)) return { state, ends };
        }
        const next = take(state, legal[(seed + state.takes.length * stride) % legal.length]!);
        if (!next.ok) throw new Error('a legal take was refused');
        state = next.state;
      }
    }
  }
  throw new Error(`no game near a ${ending} was found`);
}

/** A real game one take before a win by a line or a square for `mover`, who is to move. */
export function nearWin(mover: Player): { state: GameState; wins: CellId[] } {
  const { state, ends } = nearEnding('shape', mover);
  return { state, wins: ends };
}

/**
 * Stores `state` as the saved game before the app loads, once per tab, so Continue resumes it: a bot game
 * at Easy, or a two-player game.
 */
export async function seedSavedGame(page: Page, state: GameState, mode: 'bot' | 'two-player') {
  const save = JSON.stringify({ version: 3, mode, ...(mode === 'bot' ? { difficulty: 'easy' } : {}), score: { A: 0, B: 0, draws: 0 }, log: gameLogOf(state) });
  await page.addInitScript((value: string) => {
    if (window.sessionStorage.getItem('test.seeded')) return;
    window.sessionStorage.setItem('test.seeded', 'true');
    window.localStorage.setItem('okiya.saved-match', value);
  }, save);
}

/** One seat's avatar as the page shows it: its face, its reaction and the reaction's key. */
export interface SeatLook {
  readonly expression: string | null;
  readonly reaction: string | null;
  readonly key: string | null;
}

/**
 * Starts recording every change of `data-expression`, `data-reaction` and `data-reaction-key` on both
 * seats with a MutationObserver installed in the page, as a list of snapshots of both seats, the
 * current one first. Call it before each action, so a short face like the bot's `thinking` is never missed.
 */
export async function recordReactions(page: Page) {
  await page.evaluate(() => {
    const w = window as unknown as { __looks: unknown[]; __observer?: MutationObserver };
    w.__observer?.disconnect();
    const look = (player: string) => {
      const element = document.querySelector(`[data-testid="seat-${player}"]`);
      return { expression: element?.getAttribute('data-expression') ?? null, reaction: element?.getAttribute('data-reaction') ?? null, key: element?.getAttribute('data-reaction-key') ?? null };
    };
    const snapshot = () => ({ A: look('A'), B: look('B') });
    w.__looks = [snapshot()];
    w.__observer = new MutationObserver(() => w.__looks.push(snapshot()));
    for (const player of ['A', 'B']) {
      const element = document.querySelector(`[data-testid="seat-${player}"]`);
      if (element) w.__observer.observe(element, { attributes: true, attributeFilter: ['data-expression', 'data-reaction', 'data-reaction-key'] });
    }
  });
}

/** The snapshots recorded since `recordReactions`, oldest first. */
export async function recordedLooks(page: Page): Promise<{ A: SeatLook; B: SeatLook }[]> {
  return page.evaluate(() => (window as unknown as { __looks: { A: SeatLook; B: SeatLook }[] }).__looks);
}

/** Each seat's avatar now. */
export async function seatLooks(page: Page): Promise<{ A: SeatLook; B: SeatLook }> {
  return page.evaluate(() => {
    const look = (player: string) => {
      const element = document.querySelector(`[data-testid="seat-${player}"]`)!;
      return { expression: element.getAttribute('data-expression'), reaction: element.getAttribute('data-reaction'), key: element.getAttribute('data-reaction-key') };
    };
    return { A: look('A'), B: look('B') };
  });
}

/** Every pair of a shown toast and a board cell whose boxes overlap; empty when no toast covers a tile. */
export async function toastsOverCells(page: Page): Promise<string[]> {
  return page.evaluate(() => {
    const cells = [...document.querySelectorAll('[data-testid="board"] [data-cell]')].map((cell) => ({ cell: cell.getAttribute('data-cell')!, box: cell.getBoundingClientRect() }));
    const overlaps: string[] = [];
    for (const toast of document.querySelectorAll('[data-testid="toast"]')) {
      const box = toast.getBoundingClientRect();
      for (const { cell, box: other } of cells) {
        if (box.left < other.right && other.left < box.right && box.top < other.bottom && other.top < box.bottom) overlaps.push(`${toast.textContent} over ${cell}`);
      }
    }
    return overlaps;
  });
}

export const isEdge = (cell: string) => /^[AD]/.test(cell) || /[14]$/.test(cell);

export const match = (page: Page) => page.getByTestId('match-screen');
export const board = (page: Page) => page.getByTestId('board');
export const seat = (page: Page, player: 'A' | 'B') => page.getByTestId(`seat-${player}`);
export const seatStatus = (page: Page, player: 'A' | 'B') => page.getByTestId(`seat-${player}-status`);
export const matchCard = (page: Page) => page.getByTestId('match-card');
export const cellAt = (page: Page, cell: string) => page.locator(`[data-testid="board"] [data-cell="${cell}"]`);
export const glowing = (page: Page) => page.locator('[data-testid="board"] [data-cell][data-glow="true"]');
export const refusalToast = (page: Page) => page.locator('[data-testid="toast"][data-kind="refusal"]');
export const takeToast = (page: Page) => page.locator('[data-testid="toast"][data-kind="take"]');
export const toasts = (page: Page) => page.getByTestId('toast');

/**
 * On wide screens the seats sit beside the board (PRD U2): Player 1's seat wholly left of the board's
 * frame and Player 2's wholly right of it, each level with the board rather than above or below it.
 */
export async function expectSeatsBeside(page: Page) {
  const [frame, left, right] = await Promise.all([page.getByTestId('board-frame'), seat(page, 'A'), seat(page, 'B')].map(async (locator) => (await locator.boundingBox())!));
  expect(left!.x + left!.width).toBeLessThanOrEqual(frame!.x);
  expect(right!.x).toBeGreaterThanOrEqual(frame!.x + frame!.width);
  for (const box of [left!, right!]) {
    expect(box.y).toBeLessThan(frame!.y + frame!.height);
    expect(box.y + box.height).toBeGreaterThan(frame!.y);
  }
}

/**
 * The Match card's tile right after a take (PRD U8): whether it carries any animation other than its
 * short crossfade, its crossfade's duration, whether it takes taps (the element hit at its own centre is
 * inside it), and the centre of a glowing cell to tap next.
 */
export async function matchTileNow(page: Page) {
  return page.evaluate(() => {
    const tile = document.querySelector('[data-testid="match-card"] .match-text');
    const glow = document.querySelector('[data-testid="board"] [data-cell][data-glow="true"]');
    if (!tile || !glow) return null;
    const box = tile.getBoundingClientRect();
    const target = glow.getBoundingClientRect();
    const hit = document.elementFromPoint(box.left + box.width / 2, box.top + box.height / 2);
    return {
      animations: getComputedStyle(tile).animationName.split(',').map((name) => name.trim()),
      duration: getComputedStyle(tile).animationDuration,
      transform: getComputedStyle(tile).transform,
      takesTaps: hit !== null && tile.contains(hit),
      next: { cell: glow.getAttribute('data-cell')!, x: target.left + target.width / 2, y: target.top + target.height / 2 },
    };
  });
}

/** Every pair of an element and a board cell whose boxes overlap; empty when it covers no cell. */
export async function overCells(page: Page, testId: string): Promise<string[]> {
  return page.evaluate((id) => {
    const element = document.querySelector(`[data-testid="${id}"]`);
    if (!element) return [];
    const box = element.getBoundingClientRect();
    return [...document.querySelectorAll('[data-testid="board"] [data-cell]')]
      .filter((cell) => {
        const other = cell.getBoundingClientRect();
        return box.left < other.right && other.left < box.right && box.top < other.bottom && other.top < box.bottom;
      })
      .map((cell) => cell.getAttribute('data-cell')!);
  }, testId);
}

/**
 * The board's spacing as the page lays it out: the tile size, the gaps between neighbouring tiles across
 * and down, and the padding between the board's edges and the outer tiles, each as a share of a tile.
 */
export async function boardSpacing(page: Page) {
  return page.evaluate(() => {
    const board = document.querySelector('[data-testid="board"]')!.getBoundingClientRect();
    const slots = [...document.querySelectorAll('[data-testid="board"] [role="gridcell"]')].map((slot) => slot.getBoundingClientRect());
    const tile = slots[0]!.width;
    return {
      tile,
      tileHeight: slots[0]!.height,
      across: (slots[1]!.left - slots[0]!.right) / tile,
      down: (slots[4]!.top - slots[0]!.bottom) / tile,
      padding: [slots[0]!.left - board.left, slots[0]!.top - board.top, board.right - slots[15]!.right, board.bottom - slots[15]!.bottom].map((gap) => gap / tile),
    };
  });
}

/** The number of takes so far, from the match screen. */
export async function takeCount(page: Page): Promise<number> {
  return Number(await match(page).getAttribute('data-takes'));
}

/** The player to move, from the match screen. */
export async function toMove(page: Page): Promise<'A' | 'B'> {
  return (await match(page).getAttribute('data-to-move')) as 'A' | 'B';
}

/** Waits until a person may take, or the game has ended; the bot's reply may take up to 10 s. */
export async function waitForHumanTurn(page: Page) {
  await expect
    .poll(async () => (await match(page).getAttribute('data-accepts-takes')) === 'true' || (await page.getByTestId('end-screen').count()) > 0, { timeout: BOT_REPLY_MS })
    .toBe(true);
}

/** One cell as the page shows it. */
export interface PageCell {
  readonly cell: string;
  readonly terrain: string;
  readonly symbol: string;
  /** The token's player, A or B, or null while the tile is on the board. */
  readonly owner: string | null;
  readonly glow: boolean;
  readonly last: boolean;
  readonly winning: boolean;
  readonly edge: boolean;
  readonly label: string;
}

/** Every cell of the board, read from the page. */
export async function readBoard(page: Page): Promise<PageCell[]> {
  return board(page)
    .locator('[data-cell]')
    .evaluateAll((elements) =>
      elements.map((element) => ({
        cell: element.getAttribute('data-cell')!,
        terrain: element.getAttribute('data-terrain')!,
        symbol: element.getAttribute('data-symbol')!,
        owner: element.getAttribute('data-owner'),
        glow: element.getAttribute('data-glow') === 'true',
        last: element.getAttribute('data-last') === 'true',
        winning: element.getAttribute('data-winning') === 'true',
        edge: element.getAttribute('data-edge') === 'true',
        label: element.getAttribute('aria-label')!,
      })),
    );
}

/** The tile to match from the Match card, or null at the opening. */
export async function readLastTile(page: Page): Promise<{ terrain: string; symbol: string } | null> {
  const terrain = await matchCard(page).getAttribute('data-terrain');
  const symbol = await matchCard(page).getAttribute('data-symbol');
  return terrain && symbol ? { terrain, symbol } : null;
}

/**
 * The legal takes worked out from the page alone (spec §3): the free edge tiles at the opening,
 * else the free tiles sharing the last tile's terrain or symbol.
 */
export async function legalFromPage(page: Page): Promise<{ legal: string[]; illegal: PageCell[]; cells: PageCell[] }> {
  const cells = await readBoard(page);
  const last = await readLastTile(page);
  const free = cells.filter((cell) => cell.owner === null);
  const isLegal = (cell: PageCell) => (last ? cell.terrain === last.terrain || cell.symbol === last.symbol : cell.edge);
  return { legal: free.filter(isLegal).map((cell) => cell.cell), illegal: free.filter((cell) => !isLegal(cell)), cells };
}

/** Takes the first glowing tile for the player to move and waits until the take is made; returns its cell. */
export async function takeGlowing(page: Page): Promise<string> {
  const target = glowing(page).first();
  await expect(target).toBeVisible();
  const cell = (await target.getAttribute('data-cell'))!;
  const player = await toMove(page);
  const before = await takeCount(page);
  await target.click();
  await expect.poll(() => takeCount(page)).toBeGreaterThan(before);
  await expect(cellAt(page, cell)).toHaveAttribute('data-owner', player);
  return cell;
}

/**
 * Plays glowing takes until the end screen shows: in a bot game for the human with the bot's replies,
 * in a two-player game for both seats. Fails after `maxTakes` takes in all.
 */
export async function playToEnd(page: Page, maxTakes = 20) {
  const end = page.getByTestId('end-screen');
  for (;;) {
    await waitForHumanTurn(page);
    if (await end.isVisible()) return;
    const takes = await takeCount(page);
    if (takes >= maxTakes) throw new Error(`The game did not end within ${maxTakes} takes.`);
    await takeGlowing(page);
  }
}

/** Everything the board, the seats and the Match card show, for comparing two moments of a game. */
export async function gameSnapshot(page: Page) {
  const cells = await readBoard(page);
  return page.evaluate((boardCells) => {
    const attr = (selector: string, name: string) => document.querySelector(selector)?.getAttribute(name) ?? null;
    const text = (selector: string) => document.querySelector(selector)?.textContent ?? null;
    const seat = (player: string) => ({
      name: text(`[data-testid="seat-${player}-name"]`),
      status: text(`[data-testid="seat-${player}-status"]`),
      lit: attr(`[data-testid="seat-${player}"]`, 'data-lit'),
      tokensLeft: attr(`[data-testid="seat-${player}"]`, 'data-tokens-left'),
      score: attr(`[data-testid="seat-${player}"]`, 'data-score'),
    });
    return {
      cells: boardCells,
      tokens: document.querySelectorAll('[data-testid="board"] [data-testid="token"]').length,
      matchCard: `${attr('[data-testid="match-card"]', 'data-terrain')}-${attr('[data-testid="match-card"]', 'data-symbol')}`,
      matchCardText: text('[data-testid="match-card"]'),
      mode: attr('[data-testid="match-screen"]', 'data-mode'),
      toMove: attr('[data-testid="match-screen"]', 'data-to-move'),
      takes: attr('[data-testid="match-screen"]', 'data-takes'),
      seats: [seat('A'), seat('B')],
      score: attr('[data-testid="scoreboard"]', 'aria-label'),
    };
  }, cells);
}

/**
 * Every visible text element whose contrast against its effective background is below 4.5:1 (PRD U5).
 * The background is read up the tree to the first opaque layer: each ancestor's solid colour and the
 * colour stops of its painted `background-image` (Chrome reports them as `rgb()` or `color()`), with
 * translucent colours composited onto the layers below (a transparent stop adds nothing). The text must
 * reach 4.5:1 against the solid colour and against every stop, so a gradient's worst stop counts. Text
 * under any opacity below 1 counts as failing, so dimming by opacity can never pass unseen.
 */
export async function lowContrastText(page: Page): Promise<string[]> {
  return page.evaluate(() => {
    type Colour = { r: number; g: number; b: number; a: number };
    const parse = (value: string): Colour => {
      const parts = value.match(/-?[\d.]+(?:e-?\d+)?/g)?.map(Number) ?? [0, 0, 0, 0];
      // color(srgb r g b / a) gives channels from 0 to 1.
      const scale = value.startsWith('color(') ? 255 : 1;
      return { r: parts[0]! * scale, g: parts[1]! * scale, b: parts[2]! * scale, a: parts.length > 3 ? parts[3]! : 1 };
    };
    /** The colour stops of a computed background-image; null when one is in a colour space this helper cannot read. */
    const stops = (image: string): Colour[] | null => {
      if (image === 'none') return [];
      const found = [...image.matchAll(/(rgba?|color|oklab|oklch|lab|lch|hsla?)\([^()]*\)/g)];
      if (found.some((match) => match[1] !== 'rgb' && match[1] !== 'rgba' && !match[0].startsWith('color(srgb'))) return null;
      return found.map((match) => parse(match[0]));
    };
    const over = (top: Colour, bottom: Colour): Colour => ({
      r: top.r * top.a + bottom.r * (1 - top.a),
      g: top.g * top.a + bottom.g * (1 - top.a),
      b: top.b * top.a + bottom.b * (1 - top.a),
      a: 1,
    });
    const channel = (c: number) => {
      const v = c / 255;
      return v <= 0.039_28 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
    };
    const luminance = ({ r, g, b }: Colour) => 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
    /** Every colour the text may sit on: the layers from the first opaque one down to the element, composited. */
    const backgrounds = (element: Element): Colour[] | null => {
      const layers: { colour: Colour; stops: Colour[] }[] = [];
      for (let node: Element | null = element; node; node = node.parentElement) {
        const style = getComputedStyle(node);
        const colour = parse(style.backgroundColor);
        const painted = stops(style.backgroundImage);
        if (painted === null) return null;
        if (colour.a > 0 || painted.length > 0) layers.push({ colour, stops: painted });
        if (colour.a >= 1 || (painted.length > 0 && painted.every((stop) => stop.a >= 1))) break;
      }
      let candidates: Colour[] = [{ r: 255, g: 255, b: 255, a: 1 }];
      for (const layer of layers.reverse()) {
        const covered = layer.stops.length > 0 && layer.stops.every((stop) => stop.a >= 1);
        const next: Colour[] = [];
        for (const below of candidates) {
          const base = over(layer.colour, below);
          // The solid colour shows wherever the gradient lets it through.
          if (!covered || layer.colour.a > 0) next.push(base);
          for (const stop of layer.stops) next.push(over(stop, base));
        }
        const seen = new Set<string>();
        candidates = next.filter((colour) => {
          const id = [colour.r, colour.g, colour.b].map((c) => c.toFixed(1)).join();
          if (seen.has(id)) return false;
          seen.add(id);
          return true;
        });
      }
      return candidates;
    };
    const opacity = (element: Element) => {
      let value = 1;
      for (let node: Element | null = element; node; node = node.parentElement) value *= Number(getComputedStyle(node).opacity);
      return value;
    };
    const failures: string[] = [];
    for (const element of document.body.querySelectorAll('*')) {
      const ownText = [...element.childNodes].some((node) => node.nodeType === Node.TEXT_NODE && node.textContent!.trim() !== '');
      if (!ownText) continue;
      const style = getComputedStyle(element);
      const rect = element.getBoundingClientRect();
      if (style.visibility === 'hidden' || rect.width <= 1 || rect.height <= 1) continue;
      const label = `${element.tagName}.${element.className} "${element.textContent!.trim().slice(0, 30)}"`;
      const seen = opacity(element);
      if (seen === 0) continue;
      const color = parse(style.color);
      if (seen < 1 || color.a < 1) {
        failures.push(`${label}: translucent (${(seen * color.a).toFixed(2)})`);
        continue;
      }
      const under = backgrounds(element);
      if (under === null) {
        failures.push(`${label}: a background colour in an unreadable colour space`);
        continue;
      }
      const fg = luminance(color);
      const worst = Math.min(...under.map((background) => {
        const bg = luminance(background);
        return (Math.max(fg, bg) + 0.05) / (Math.min(fg, bg) + 0.05);
      }));
      if (worst < 4.5) failures.push(`${label}: ${worst.toFixed(2)}`);
    }
    return failures;
  });
}

/** The game log of a state, as a save stores it. */
export const gameLogOfState = (state: GameState) => gameLogOf(state);

/** The colour themes (PRD U5), Walnut and parchment first. */
export const PALETTES: readonly PaletteId[] = PALETTE_IDS;

/** Switches the page's colour theme in place, as the menu does, without replaying anything. */
export async function setPalette(page: Page, palette: PaletteId) {
  await page.evaluate((id) => document.documentElement.setAttribute('data-palette', id), palette);
  await expect(page.locator('html')).toHaveAttribute('data-palette', palette);
}

/** The score of the sitting as the scoreboard row shows it: each seat's wins, the draws, and its accessible name. */
export async function readScore(page: Page) {
  const row = page.getByTestId('scoreboard');
  const [a, b, draws] = await Promise.all(['data-a', 'data-b', 'data-draws'].map(async (name) => Number(await row.getAttribute(name))));
  return { a: a!, b: b!, draws: draws!, text: (await row.getAttribute('aria-label'))! };
}

/**
 * A real game after `takes` takes, each the legal take a fixed stride picks, Player 1 starting: a seeded
 * position for a saved game with Continue, so a check never depends on which tile a bot takes.
 */
export function seededPosition(takes: number, seed = 11): GameState {
  let state = newGame({ seed, starter: 'A' });
  for (let i = 0; i < takes; i += 1) {
    const legal = legalTakes(state);
    const next = take(state, legal[(i * 5 + seed) % legal.length]!);
    if (!next.ok || next.state.result) throw new Error('the seeded position ended early');
    state = next.state;
  }
  return state;
}

/** Writes a saved game into storage and resumes it with Continue from a reload. */
export async function continueSaved(page: Page, state: GameState, mode: 'bot' | 'two-player') {
  const save = JSON.stringify({ version: 3, mode, ...(mode === 'bot' ? { difficulty: 'easy' } : {}), score: { A: 0, B: 0, draws: 0 }, log: gameLogOf(state) });
  await page.evaluate((value) => window.localStorage.setItem('okiya.saved-match', value), save);
  await page.reload();
  await page.getByTestId('continue').click();
  await expect(page.getByTestId('match-screen')).toHaveAttribute('data-takes', String(state.takes.length));
}

/** What the rendered pixels of the board say about the move highlights (PRD R2). */
export interface HighlightPixels {
  /** Each playable tile's ring against the bare well beside it: the contrast and how many well pixels were found. */
  readonly rings: { readonly cell: string; readonly ratio: number; readonly wellPixels: number; readonly sides: number }[];
  /** Each terrain's mean L* over its playable tiles and over its faded tiles, where both are present. */
  readonly lightness: { readonly terrain: string; readonly playable: number; readonly faded: number }[];
  readonly dpr: number;
}

/**
 * Measures the move highlights from the board's rendered pixels: a `locator.screenshot()` decoded in the
 * page with `createImageBitmap` and a canvas. Ring pixels are read at the ring's mid-width (1.5 px in from
 * the tile's edge: its 1 px border and 2 px inset edge) along the middle of each side; well pixels along the
 * outward normal into the gap or the padding, keeping only those within ΔE*ab 3 of the rendered --well
 * colour, so neither a halo nor a shadow counts. A playable tile with no bare well beside it fails loudly.
 */
export async function highlightPixels(page: Page): Promise<HighlightPixels> {
  const shot = await board(page).screenshot();
  return page.evaluate(async (png) => {
    const bytes = Uint8Array.from(atob(png), (char) => char.charCodeAt(0));
    const bitmap = await createImageBitmap(new Blob([bytes], { type: 'image/png' }));
    const canvas = document.createElement('canvas');
    canvas.width = bitmap.width;
    canvas.height = bitmap.height;
    const context = canvas.getContext('2d', { colorSpace: 'srgb', willReadFrequently: true })!;
    context.drawImage(bitmap, 0, 0);
    const { data } = context.getImageData(0, 0, bitmap.width, bitmap.height);
    const boardElement = document.querySelector('[data-testid="board"]')!;
    const box = boardElement.getBoundingClientRect();
    const dpr = bitmap.width / box.width;
    type Rgb = [number, number, number];
    const pixel = (x: number, y: number): Rgb | null => {
      const px = Math.floor((x - box.left) * dpr);
      const py = Math.floor((y - box.top) * dpr);
      if (px < 0 || py < 0 || px >= bitmap.width || py >= bitmap.height) return null;
      const at = (py * bitmap.width + px) * 4;
      return [data[at]!, data[at + 1]!, data[at + 2]!];
    };
    const linear = (c: number) => {
      const v = c / 255;
      return v <= 0.040_45 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
    };
    const lab = ([r, g, b]: Rgb): Rgb => {
      const [lr, lg, lb] = [r, g, b].map(linear) as Rgb;
      const f = (t: number) => (t > 216 / 24_389 ? Math.cbrt(t) : ((24_389 / 27) * t + 16) / 116);
      const fx = f((0.4124 * lr + 0.3576 * lg + 0.1805 * lb) / 0.950_47);
      const fy = f(0.2126 * lr + 0.7152 * lg + 0.0722 * lb);
      const fz = f((0.0193 * lr + 0.1192 * lg + 0.9505 * lb) / 1.088_83);
      return [116 * fy - 16, 500 * (fx - fy), 200 * (fy - fz)];
    };
    const deltaE = (a: Rgb, b: Rgb) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
    const luminance = ([r, g, b]: Rgb) => 0.2126 * linear(r) + 0.7152 * linear(g) + 0.0722 * linear(b);
    const contrast = (a: Rgb, b: Rgb) => {
      const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x) as [number, number];
      return (hi + 0.05) / (lo + 0.05);
    };
    const mean = (colours: Rgb[]): Rgb => colours.reduce<Rgb>((sum, c) => [sum[0] + c[0] / colours.length, sum[1] + c[1] / colours.length, sum[2] + c[2] / colours.length], [0, 0, 0]);
    const wellColour = getComputedStyle(boardElement).backgroundColor.match(/[\d.]+/g)!.slice(0, 3).map(Number) as Rgb;
    const wellLab = lab(wellColour);
    const cells = [...boardElement.querySelectorAll('[data-cell]')].map((element) => ({
      cell: element.getAttribute('data-cell')!,
      terrain: element.getAttribute('data-terrain')!,
      glow: element.getAttribute('data-glow') === 'true',
      faded: element.getAttribute('data-faded') === 'true',
      rect: element.getBoundingClientRect(),
    }));
    // The gap between tiles, the same as the board's padding.
    const gap = boardElement.querySelector('[role="gridcell"]')!.getBoundingClientRect().left - box.left;
    const step = 1 / dpr;
    const rings = cells
      .filter((cell) => cell.glow)
      .map(({ cell, rect }) => {
        const ring: Rgb[] = [];
        const well: Rgb[] = [];
        let sides = 0;
        // Each side: [the ring point at mid-width, the outward normal]; sampled along the middle fifth of the side.
        const along = (from: number, length: number) => Array.from({ length: Math.max(1, Math.floor((length / 5) * dpr)) }, (_v, index) => from + length * 0.4 + index * step);
        const sidesOf = [
          { points: along(rect.top, rect.height).map((y) => [rect.left + 1.5, y] as const), out: [-1, 0] as const },
          { points: along(rect.top, rect.height).map((y) => [rect.right - 1.5, y] as const), out: [1, 0] as const },
          { points: along(rect.left, rect.width).map((x) => [x, rect.top + 1.5] as const), out: [0, -1] as const },
          { points: along(rect.left, rect.width).map((x) => [x, rect.bottom - 1.5] as const), out: [0, 1] as const },
        ];
        for (const { points, out } of sidesOf) {
          let found = 0;
          for (const [x, y] of points) {
            const own = pixel(x, y);
            if (own) ring.push(own);
            // Out from the tile's edge across the gap (or the padding), never as far as the next tile.
            const edgeX = out[0] < 0 ? rect.left : out[0] > 0 ? rect.right : x;
            const edgeY = out[1] < 0 ? rect.top : out[1] > 0 ? rect.bottom : y;
            for (let d = 0.5; d < gap - 0.5; d += step) {
              const sample = pixel(edgeX + out[0] * d, edgeY + out[1] * d);
              if (!sample) break;
              if (deltaE(lab(sample), wellLab) < 3) {
                well.push(sample);
                found += 1;
              }
            }
          }
          if (found > 0) sides += 1;
        }
        return { cell, ratio: well.length > 0 ? contrast(mean(ring), mean(well)) : 0, wellPixels: well.length, sides };
      });
    // Mean L* of each tile's art, inside its ring.
    const tileLightness = (rect: DOMRect) => {
      let sum = 0;
      let count = 0;
      for (let y = rect.top + 5; y < rect.bottom - 5; y += step) {
        for (let x = rect.left + 5; x < rect.right - 5; x += step) {
          const sample = pixel(x, y);
          if (!sample) continue;
          sum += lab(sample)[0];
          count += 1;
        }
      }
      return sum / count;
    };
    const terrains = [...new Set(cells.map((cell) => cell.terrain))];
    const lightness = terrains.flatMap((terrain) => {
      const of = (pick: (cell: (typeof cells)[number]) => boolean) => cells.filter((cell) => cell.terrain === terrain && pick(cell)).map((cell) => tileLightness(cell.rect));
      const playable = of((cell) => cell.glow);
      const faded = of((cell) => cell.faded);
      if (playable.length === 0 || faded.length === 0) return [];
      const average = (values: number[]) => values.reduce((a, b) => a + b, 0) / values.length;
      return [{ terrain, playable: average(playable), faded: average(faded) }];
    });
    return { rings, lightness, dpr };
  }, shot.toString('base64'));
}
