/// <reference lib="dom" />
// The DOM library types the callbacks that run in the page (addInitScript, evaluate).
import { expect, type Locator, type Page, type TestInfo } from '@playwright/test';

export async function attachScreenshot(page: Page, testInfo: TestInfo, id: string) {
  const path = testInfo.outputPath(`${id}.png`);
  await page.screenshot({ path, fullPage: true });
  await testInfo.attach(`screenshot:${id}`, { path, contentType: 'image/png' });
}

/**
 * Replaces the page's `crypto.getRandomValues` with a seeded generator (mulberry32) before any
 * script runs, so the match seed and the bot's private seed are fixed by the test, never by an
 * app parameter. The first value is the match seed, the second the bot's private seed.
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

/**
 * With randomness 1 the human opens; deploying the first tray token on the first glowing cell
 * (the Teleporter on A1) makes the Easy bot reply into one of the player's default setup traps,
 * and on the next turn the Teleporter has a legal ability but no move.
 */
export const HUMAN_STARTS = 1;

/** With randomness 6 the human opens, and after the first deploy and the reply the Teleporter has both moves and its ability. */
export const MOVES_AND_ABILITY = 6;

/** Opens the title screen with fixed randomness and How to Play already seen. */
export async function openTitle(page: Page, seed: number = HUMAN_STARTS) {
  await fixRandomness(page, seed);
  await skipFirstVisitHowTo(page);
  await page.goto('/');
  await expect(page.getByTestId('title-screen')).toBeVisible();
}

/** From the title screen: New game, then a difficulty; the setup screen opens. */
export async function openSetup(page: Page, depth = 'Easy') {
  await page.getByRole('button', { name: /^New game/ }).click();
  await page.getByRole('button', { name: new RegExp(`^${depth}\\b`) }).click();
  await expect(page.getByTestId('setup-board')).toBeVisible();
}

/** Opens the title screen and starts a match with the default setup. */
export async function startMatch(page: Page, { seed = HUMAN_STARTS, depth = 'Easy' }: { seed?: number; depth?: string } = {}) {
  await openTitle(page, seed);
  await openSetup(page, depth);
  await page.getByRole('button', { name: 'Use default setup' }).click();
  await expect(page.getByTestId('board')).toBeVisible();
}

export const isEdge = (cell: string) => /^[AD]/.test(cell) || /[14]$/.test(cell);

export const board = (page: Page) => page.getByTestId('board');
export const glowing = (page: Page) => page.locator('[data-testid="board"] [data-cell][data-glow="true"]');
export const ownTray = (page: Page) => page.getByTestId('own-tray');
export const trayTokens = (page: Page) => page.locator('[data-testid="own-tray"] button[data-fighter]');
export const toasts = (page: Page) => page.getByTestId('toast');

/** The engine's turn number, which grows by one per action; it is not shown on screen. */
export async function turnNumber(page: Page): Promise<number> {
  return Number(await page.getByTestId('turn').getAttribute('data-turn'));
}

export async function cellsOf(locator: Locator): Promise<string[]> {
  return locator.evaluateAll((cells) => cells.map((cell) => cell.getAttribute('data-cell')!));
}

/** Waits until the human may act again, or the match has ended. */
export async function waitForHumanTurn(page: Page) {
  await expect
    .poll(
      async () => (await page.getByTestId('turn').getAttribute('data-active')) === 'A' || (await page.getByTestId('end-screen').count()) > 0,
      { timeout: 15_000 },
    )
    .toBe(true);
}

/** Deploys the first tray token onto the first glowing cell; returns the cell and the fighter id. */
export async function deployFirst(page: Page) {
  const token = trayTokens(page).first();
  const fighter = (await token.getAttribute('data-fighter'))!;
  await token.click();
  const target = glowing(page).first();
  await expect(target).toBeVisible();
  const cell = (await target.getAttribute('data-cell'))!;
  const before = await turnNumber(page);
  await target.click();
  await expect.poll(() => turnNumber(page)).toBeGreaterThan(before);
  return { cell, fighter };
}

/**
 * Plays one glowing legal action: the first token that glows (board in reading order, then the
 * tray), then its first glowing cell, or else its ability button and the first glowing target,
 * or its recharge button.
 */
export async function playGlowingAction(page: Page) {
  const before = await turnNumber(page);
  await page.locator('[data-testid="board"] [data-cell][data-playable], [data-testid="own-tray"] button[data-playable]').first().click();
  // A selected token shows glowing cells, an on-token button, or both.
  await expect(page.locator('[data-testid="board"] [data-glow="true"], [data-testid="token-actions"]').first()).toBeVisible();
  if ((await glowing(page).count()) === 0) {
    const button = page.getByTestId('token-actions').getByRole('button').first();
    const kind = await button.getAttribute('data-kind');
    await button.click();
    if (kind === 'ability') await glowing(page).first().click();
  } else {
    await glowing(page).first().click();
  }
  await expect.poll(() => turnNumber(page)).toBeGreaterThan(before);
}

/** Everything the board, the trays and the top bar show, for comparing two moments of a match. */
export async function matchSnapshot(page: Page) {
  return page.evaluate(() => {
    const attr = (selector: string, name: string) => document.querySelector(selector)?.getAttribute(name) ?? null;
    return {
      cells: [...document.querySelectorAll('[data-testid="board"] [data-cell]')].map((cell) => ({
        cell: cell.getAttribute('data-cell'),
        tile: `${cell.getAttribute('data-terrain')}-${cell.getAttribute('data-symbol')}`,
        owner: cell.getAttribute('data-owner'),
        trap: cell.getAttribute('data-own-trap'),
        label: cell.getAttribute('aria-label'),
      })),
      tokens: [...document.querySelectorAll('[data-testid="board"] [data-testid="token"]')].map((token) => token.getAttribute('data-label')),
      tray: [...document.querySelectorAll('[data-testid="own-tray"] button')].map((button) => button.getAttribute('aria-label')),
      botTray: attr('[data-testid="bot-tray"]', 'data-count'),
      constraint: `${attr('[data-testid="constraint"]', 'data-terrain')}-${attr('[data-testid="constraint"]', 'data-symbol')}`,
      constraintText: document.querySelector('[data-testid="constraint"]')?.textContent ?? null,
      turn: attr('[data-testid="turn"]', 'data-turn'),
      active: attr('[data-testid="turn"]', 'data-active'),
      recharges: `${attr('[data-testid="recharges"]', 'data-a')}/${attr('[data-testid="recharges"]', 'data-b')}`,
    };
  });
}

/** Every visible text element whose contrast against its effective background is below 4.5:1. */
export async function lowContrastText(page: Page): Promise<string[]> {
  return page.evaluate(() => {
    const parse = (value: string) => {
      const parts = value.match(/[\d.]+/g)?.map(Number) ?? [0, 0, 0, 0];
      return { r: parts[0]!, g: parts[1]!, b: parts[2]!, a: parts.length > 3 ? parts[3]! : 1 };
    };
    const channel = (c: number) => {
      const v = c / 255;
      return v <= 0.039_28 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
    };
    const luminance = ({ r, g, b }: { r: number; g: number; b: number }) => 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
    const background = (element: Element | null) => {
      for (let node = element; node; node = node.parentElement) {
        const color = parse(getComputedStyle(node).backgroundColor);
        if (color.a > 0) return color;
      }
      return { r: 255, g: 255, b: 255, a: 1 };
    };
    const failures: string[] = [];
    for (const element of document.body.querySelectorAll('*')) {
      const ownText = [...element.childNodes].some((node) => node.nodeType === Node.TEXT_NODE && node.textContent!.trim() !== '');
      if (!ownText) continue;
      const style = getComputedStyle(element);
      const rect = element.getBoundingClientRect();
      if (style.visibility === 'hidden' || rect.width === 0 || rect.height === 0) continue;
      const fg = luminance(parse(style.color));
      const bg = luminance(background(element));
      const ratio = (Math.max(fg, bg) + 0.05) / (Math.min(fg, bg) + 0.05);
      if (ratio < 4.5) failures.push(`${element.tagName}.${element.className} "${element.textContent!.trim().slice(0, 30)}": ${ratio.toFixed(2)}`);
    }
    return failures;
  });
}
