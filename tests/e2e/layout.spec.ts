/// <reference lib="dom" />
// The DOM library types the callbacks that run in the page (page.evaluate).
import { expect, test, type Page } from '@playwright/test';
import {
  attachScreenshot,
  board,
  cellAt,
  chooseDifficulty,
  glowing,
  lowContrastText,
  openTitle,
  readBoard,
  refusalToast,
  takeCount,
  takeGlowing,
  waitForHumanTurn,
} from './helpers';

test.describe('dark colour scheme', () => {
  test.use({ colorScheme: 'dark' });

  test('[scenario:dark-theme] the board, tiles, emblems and both players’ tokens stay distinguishable and all text is readable in dark', async ({ page }, testInfo) => {
    await openTitle(page);
    expect(await lowContrastText(page)).toEqual([]);
    await page.getByTestId('title-screen').getByRole('button', { name: 'How to play' }).click();
    await expect(page.getByRole('dialog')).toBeVisible();
    expect(await lowContrastText(page)).toEqual([]);
    await page.keyboard.press('Escape');
    await page.getByTestId('title-screen').getByRole('button', { name: 'Settings' }).click();
    expect(await lowContrastText(page)).toEqual([]);
    await page.keyboard.press('Escape');

    await page.getByRole('button', { name: /^New game/ }).click();
    expect(await lowContrastText(page)).toEqual([]);
    await page.getByRole('button', { name: /^Easy\b/ }).click();
    await expect(board(page)).toBeVisible();
    expect(await lowContrastText(page)).toEqual([]);
    await takeGlowing(page);
    await waitForHumanTurn(page);

    // The dark set is in use.
    const pageBackground = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
    const [r, g, b] = pageBackground.match(/\d+/g)!.map(Number);
    expect(r! + g! + b!).toBeLessThan(120);

    // Four terrains, each with its own colour and scene; four symbols, each with its own emblem.
    const tiles = await board(page)
      .locator('[data-cell]:not([data-owner])')
      .evaluateAll((elements) =>
        elements.map((cell) => ({
          terrain: cell.getAttribute('data-terrain')!,
          symbol: cell.getAttribute('data-symbol')!,
          colour: getComputedStyle(cell).backgroundColor,
          scene: cell.querySelector('svg.scene')!.getAttribute('data-shape'),
          emblem: cell.querySelector('.tile-symbol svg')!.getAttribute('data-shape'),
          emblemSize: cell.querySelector('.tile-symbol')!.getBoundingClientRect().width,
        })),
      );
    expect(tiles).toHaveLength(14);
    const byTerrain = new Map(tiles.map((cell) => [cell.terrain, cell]));
    expect(byTerrain.size).toBe(4);
    expect(new Set([...byTerrain.values()].map((cell) => cell.colour)).size).toBe(4);
    expect(new Set([...byTerrain.values()].map((cell) => cell.scene)).size).toBe(4);
    for (const cell of tiles) {
      expect(new Set(tiles.filter((other) => other.terrain === cell.terrain).map((other) => other.scene)).size).toBe(1);
      expect(new Set(tiles.filter((other) => other.symbol === cell.symbol).map((other) => other.emblem)).size).toBe(1);
      expect(cell.emblemSize).toBeGreaterThanOrEqual(20);
    }
    expect(new Set(tiles.map((cell) => cell.emblem)).size).toBe(4);

    // Your token and the bot's differ in colour, rim and mark, and stand out from the tiles and the bare slot.
    const tokens = await board(page)
      .getByTestId('token')
      .evaluateAll((elements) =>
        elements.map((token) => ({
          owner: token.getAttribute('data-owner'),
          rim: getComputedStyle(token).borderTopStyle,
          colour: getComputedStyle(token).backgroundColor,
          mark: token.querySelector('svg.token-mark')!.getAttribute('data-shape'),
          slot: getComputedStyle(token.closest('[data-cell]')!).backgroundColor,
          label: token.closest('[data-cell]')!.getAttribute('aria-label')!,
        })),
      );
    const own = tokens.find((token) => token.owner === 'you')!;
    const bot = tokens.find((token) => token.owner === 'bot')!;
    expect(own.rim).not.toBe(bot.rim);
    expect(own.colour).not.toBe(bot.colour);
    expect(own.mark).not.toBe(bot.mark);
    expect(own.label).toMatch(/, your token/);
    expect(bot.label).toMatch(/, bot's token/);
    for (const token of [own, bot]) {
      expect(token.colour).not.toBe(token.slot);
      expect([...byTerrain.values()].map((cell) => cell.colour)).not.toContain(token.colour);
    }

    // All text meets 4.5:1 with a refusal toast shown, and in the menu.
    await cellAt(page, (await readBoard(page)).find((cell) => cell.owner === 'bot')!.cell).click();
    await expect(refusalToast(page)).toBeVisible();
    expect(await lowContrastText(page)).toEqual([]);
    await attachScreenshot(page, testInfo, 'dark-theme');
    await page.getByTestId('menu-button').click();
    await expect(page.getByRole('dialog', { name: 'Menu' })).toBeVisible();
    expect(await lowContrastText(page)).toEqual([]);
  });
});

/** Every tile, cell and button smaller than 44 px in either dimension. */
async function smallTargets(page: Page): Promise<string[]> {
  return page.locator('button, [role="gridcell"], [role="switch"]').evaluateAll((elements) =>
    elements.flatMap((element) => {
      const rect = element.getBoundingClientRect();
      if (rect.width === 0 && rect.height === 0) return [];
      return rect.width < 44 || rect.height < 44 ? [`${element.getAttribute('data-testid') ?? element.tagName} ${element.textContent!.trim().slice(0, 20)}: ${rect.width}×${rect.height}`] : [];
    }),
  );
}

async function overflow(page: Page) {
  return page.evaluate(() => ({
    x: document.documentElement.scrollWidth - window.innerWidth,
    y: document.documentElement.scrollHeight - window.innerHeight,
  }));
}

async function expectInside(page: Page, testIds: readonly string[]) {
  const { width, height } = page.viewportSize()!;
  for (const testId of testIds) {
    const box = (await page.getByTestId(testId).boundingBox())!;
    expect(box, testId).not.toBeNull();
    expect(box.x, testId).toBeGreaterThanOrEqual(0);
    expect(box.y, testId).toBeGreaterThanOrEqual(0);
    expect(box.x + box.width, testId).toBeLessThanOrEqual(width);
    expect(box.y + box.height, testId).toBeLessThanOrEqual(height);
  }
}

test.describe('phone viewport', () => {
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });

  test('[scenario:phone-layout] at 390 px the board, the token counts and the top bar fit without scrolling, and every tile and button is at least 44 px', async ({ page }, testInfo) => {
    await openTitle(page);
    expect((await overflow(page)).x).toBeLessThanOrEqual(0);
    expect(await smallTargets(page)).toEqual([]);
    await page.getByTestId('title-screen').getByRole('button', { name: 'How to play' }).tap();
    await expect(page.getByRole('dialog')).toBeVisible();
    expect((await overflow(page)).x).toBeLessThanOrEqual(0);
    expect(await smallTargets(page)).toEqual([]);
    await page.getByRole('button', { name: 'Close How to play' }).tap();

    await page.getByRole('button', { name: /^New game/ }).tap();
    expect((await overflow(page)).x).toBeLessThanOrEqual(0);
    expect(await smallTargets(page)).toEqual([]);
    await page.getByRole('button', { name: /^Easy\b/ }).tap();
    await expect(board(page)).toBeVisible();

    // At the start: the whole tabletop fits with no scrolling in either direction.
    const fits = ['top-bar', 'board-frame', 'token-counts', 'tokens-you', 'tokens-bot', 'turn', 'last-tile', 'menu-button'];
    expect(await overflow(page)).toEqual({ x: 0, y: 0 });
    await expectInside(page, fits);
    expect(await smallTargets(page)).toEqual([]);

    // Take a tile by touch so the last tile shows its emblems; the bot replies.
    const before = await takeCount(page);
    await glowing(page).first().tap();
    await expect.poll(() => takeCount(page)).toBeGreaterThan(before);
    await waitForHumanTurn(page);
    await expect(page.getByTestId('last-tile-terrain')).toBeVisible();
    expect(await overflow(page)).toEqual({ x: 0, y: 0 });
    await expectInside(page, [...fits, 'last-tile-terrain', 'last-tile-symbol']);
    expect(await smallTargets(page)).toEqual([]);
    await attachScreenshot(page, testInfo, 'phone-layout');

    // The menu fits too.
    await page.getByTestId('menu-button').tap();
    await expect(page.getByRole('dialog', { name: 'Menu' })).toBeVisible();
    expect((await overflow(page)).x).toBeLessThanOrEqual(0);
    expect(await smallTargets(page)).toEqual([]);
  });
});

/** Presses Tab (or Shift+Tab) until the focused element matches the selector. */
async function tabTo(page: Page, selector: string, backwards = false) {
  for (let i = 0; i < 80; i += 1) {
    if (await page.evaluate((s) => document.activeElement?.matches(s) ?? false, selector)) return;
    await page.keyboard.press(backwards ? 'Shift+Tab' : 'Tab');
  }
  throw new Error(`Tab never reached ${selector}`);
}

const focusedCell = (page: Page) => page.evaluate(() => document.activeElement?.getAttribute('data-cell') ?? null);

/** Walks focus on the board with arrow keys from the focused cell to the given cell. */
async function arrowTo(page: Page, cell: string) {
  const from = (await focusedCell(page))!;
  const rows = cell.charCodeAt(0) - from.charCodeAt(0);
  const columns = Number(cell[1]) - Number(from[1]);
  for (let i = 0; i < Math.abs(rows); i += 1) await page.keyboard.press(rows > 0 ? 'ArrowDown' : 'ArrowUp');
  for (let i = 0; i < Math.abs(columns); i += 1) await page.keyboard.press(columns > 0 ? 'ArrowRight' : 'ArrowLeft');
  expect(await focusedCell(page)).toBe(cell);
}

test('[scenario:keyboard-play] with the keyboard only, the player starts a game, opens and closes the menu and How to Play, and takes legal tiles', async ({ page }, testInfo) => {
  await openTitle(page);

  // How to Play from the title screen opens with Enter and closes with Escape.
  await tabTo(page, '[data-testid="open-how-to-play"]');
  await page.keyboard.press('Enter');
  await expect(page.getByRole('dialog', { name: 'How to play' })).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(page.getByTestId('open-how-to-play')).toBeFocused();

  // Start a game: New game, then Easy.
  await tabTo(page, '[data-testid="new-game"]', true);
  await page.keyboard.press('Enter');
  await tabTo(page, 'button[data-difficulty="easy"]');
  await page.keyboard.press('Enter');
  await expect(board(page)).toBeVisible();
  await expect(page.getByTestId('turn')).toHaveText('Your turn');

  // The menu opens with Enter and closes with Escape, and focus comes back to its button.
  await tabTo(page, '[data-testid="menu-button"]');
  await page.keyboard.press('Enter');
  await expect(page.getByRole('dialog', { name: 'Menu' })).toBeVisible();
  await expect(page.getByTestId('menu-resume')).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(page.getByTestId('menu-button')).toBeFocused();

  // How to Play from the menu: Escape closes it back to the menu, Escape again closes the menu.
  await page.keyboard.press('Enter');
  await tabTo(page, '[data-testid="menu-how-to-play"]');
  await page.keyboard.press('Enter');
  await expect(page.getByRole('dialog', { name: 'How to play' })).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog', { name: 'How to play' })).toHaveCount(0);
  await expect(page.getByTestId('menu-how-to-play')).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(page.getByTestId('menu-button')).toBeFocused();

  // Into the board, which lands on the first glowing tile; arrow keys never leave the 4×4 grid.
  await tabTo(page, '[data-testid="board"] [data-cell]');
  const lit = (await readBoard(page)).filter((cell) => cell.glow).map((cell) => cell.cell);
  expect(await focusedCell(page)).toBe(lit[0]);
  for (let i = 0; i < 5; i += 1) await page.keyboard.press('ArrowDown');
  for (let i = 0; i < 5; i += 1) await page.keyboard.press('ArrowRight');
  expect(await focusedCell(page)).toBe('D4');
  await page.keyboard.press('Home');
  expect(await focusedCell(page)).toBe('A1');

  // Enter on an inner tile is refused; Enter on a glowing edge tile takes it.
  await arrowTo(page, 'B2');
  await page.keyboard.press('Enter');
  await expect(refusalToast(page)).toContainText('is not an edge tile');
  expect(await takeCount(page)).toBe(0);
  const target = lit[lit.length - 1]!;
  await arrowTo(page, target);
  await page.keyboard.press('Enter');
  await expect(cellAt(page, target)).toHaveAttribute('data-owner', 'you');
  expect(await takeCount(page)).toBe(1);
  await waitForHumanTurn(page);
  await attachScreenshot(page, testInfo, 'keyboard-play');

  // After the bot's reply, focus is still on the board: walk to a glowing tile and take it with Space.
  expect(await focusedCell(page)).toBe(target);
  const next = (await readBoard(page)).find((cell) => cell.glow)!.cell;
  await arrowTo(page, next);
  await page.keyboard.press('Space');
  await expect(cellAt(page, next)).toHaveAttribute('data-owner', 'you');
  expect(await takeCount(page)).toBeGreaterThanOrEqual(3);
});
