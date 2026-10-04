/// <reference lib="dom" />
// The DOM library types the callbacks that run in the page (addInitScript, evaluate).
import { expect, type Page, type TestInfo } from '@playwright/test';
import { newGame, type Player } from '@okiya/game';

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
}

/** Marks How to Play as already seen, so it does not open by itself on the first visit. */
export async function skipFirstVisitHowTo(page: Page) {
  await page.addInitScript(() => window.localStorage.setItem('okiya.howto.seen', 'true'));
}

/** Opens the title screen with fixed randomness and How to Play already seen. */
export async function openTitle(page: Page, seed: number = HUMAN_STARTS) {
  await fixRandomness(page, seed);
  await skipFirstVisitHowTo(page);
  await page.goto('/');
  await expect(page.getByTestId('title-screen')).toBeVisible();
}

/** From the title screen: New game, Versus bot, then a difficulty (never Hard in tests); the board appears. */
export async function chooseDifficulty(page: Page, difficulty: 'Easy' | 'Normal' = 'Easy') {
  await page.getByRole('button', { name: /^New game/ }).click();
  await page.getByRole('button', { name: /^Versus bot/ }).click();
  await page.getByRole('button', { name: new RegExp(`^${difficulty}\\b`) }).click();
  await expect(board(page)).toBeVisible();
}

/** From the title screen: New game, then Two players; the board appears at once. */
export async function chooseTwoPlayers(page: Page) {
  await page.getByRole('button', { name: /^New game/ }).click();
  await page.getByRole('button', { name: /^Two players/ }).click();
  await expect(board(page)).toBeVisible();
  await expect(page.getByTestId('match-screen')).toHaveAttribute('data-mode', 'two-player');
}

/** Opens the title screen and starts a bot game, by default with the human starting against Easy. */
export async function startGame(page: Page, { seed = HUMAN_STARTS, difficulty = 'Easy' }: { seed?: number; difficulty?: 'Easy' | 'Normal' } = {}) {
  await openTitle(page, seed);
  await chooseDifficulty(page, difficulty);
}

/** Opens the title screen and starts a two-player game, by default with Player 1 starting. */
export async function startTwoPlayerGame(page: Page, { seed = HUMAN_STARTS }: { seed?: number } = {}) {
  await openTitle(page, seed);
  await chooseTwoPlayers(page);
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
      score: text('[data-testid="sitting-score"]'),
    };
  }, cells);
}

/**
 * Every visible text element whose contrast against its effective background is below 4.5:1. The
 * background is composited from every translucent layer up the tree, and text under any opacity
 * below 1 counts as failing, so dimming by opacity can never pass unseen.
 */
export async function lowContrastText(page: Page): Promise<string[]> {
  return page.evaluate(() => {
    const parse = (value: string) => {
      const parts = value.match(/[\d.]+/g)?.map(Number) ?? [0, 0, 0, 0];
      // color(srgb r g b / a) gives channels from 0 to 1.
      const scale = value.startsWith('color(') ? 255 : 1;
      return { r: parts[0]! * scale, g: parts[1]! * scale, b: parts[2]! * scale, a: parts.length > 3 ? parts[3]! : 1 };
    };
    const channel = (c: number) => {
      const v = c / 255;
      return v <= 0.039_28 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
    };
    const luminance = ({ r, g, b }: { r: number; g: number; b: number }) => 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
    /** The background behind an element: every ancestor's colour composited from the root down onto white. */
    const background = (element: Element | null) => {
      const layers: { r: number; g: number; b: number; a: number }[] = [];
      for (let node = element; node; node = node.parentElement) {
        const color = parse(getComputedStyle(node).backgroundColor);
        if (color.a > 0) layers.push(color);
        if (color.a >= 1) break;
      }
      let result = { r: 255, g: 255, b: 255 };
      for (const layer of layers.reverse()) {
        result = { r: layer.r * layer.a + result.r * (1 - layer.a), g: layer.g * layer.a + result.g * (1 - layer.a), b: layer.b * layer.a + result.b * (1 - layer.a) };
      }
      return result;
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
      const fg = luminance(color);
      const bg = luminance(background(element));
      const ratio = (Math.max(fg, bg) + 0.05) / (Math.min(fg, bg) + 0.05);
      if (ratio < 4.5) failures.push(`${label}: ${ratio.toFixed(2)}`);
    }
    return failures;
  });
}
