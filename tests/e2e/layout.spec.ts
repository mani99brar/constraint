/// <reference lib="dom" />
// The DOM library types the callbacks that run in the page (page.evaluate).
import { expect, test, type Page } from '@playwright/test';
import {
  attachScreenshot,
  board,
  cellAt,
  chooseTwoPlayers,
  glowing,
  lowContrastText,
  openTitle,
  readBoard,
  refusalToast,
  seat,
  seatStatus,
  takeCount,
  takeGlowing,
  waitForHumanTurn,
} from './helpers';

test.describe('dark colour scheme', () => {
  test.use({ colorScheme: 'dark' });

  test('[scenario:dark-theme] the board, tiles, emblems, both players’ tokens, both avatars and the lit and dimmed seats stay distinguishable and all text is readable in dark', async ({ page }, testInfo) => {
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
    await page.getByRole('button', { name: /^Versus bot/ }).click();
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

    // Player 1's token and Player 2's (the bot's) differ in colour, rim and mark, and stand out from the tiles and the bare slot.
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
    const own = tokens.find((token) => token.owner === 'A')!;
    const bot = tokens.find((token) => token.owner === 'B')!;
    expect(own.rim).not.toBe(bot.rim);
    expect(own.colour).not.toBe(bot.colour);
    expect(own.mark).not.toBe(bot.mark);
    expect(own.label).toMatch(/, your token/);
    expect(bot.label).toMatch(/, bot's token/);
    for (const token of [own, bot]) {
      expect(token.colour).not.toBe(token.slot);
      expect([...byTerrain.values()].map((cell) => cell.colour)).not.toContain(token.colour);
    }

    // The two avatars differ in figure and colour; the lit seat differs from the dimmed one in border and background.
    const looks = await page.evaluate(() =>
      ['A', 'B'].map((player) => {
        const seatElement = document.querySelector(`[data-testid="seat-${player}"]`)!;
        const avatar = seatElement.querySelector('svg.avatar')!;
        return {
          figure: avatar.getAttribute('data-avatar'),
          paint: getComputedStyle(avatar.querySelector('path')!).fill,
          border: getComputedStyle(seatElement).borderTopColor,
          background: getComputedStyle(seatElement).backgroundColor,
          lit: seatElement.getAttribute('data-lit'),
        };
      }),
    );
    expect(looks.map((look) => look.lit)).toEqual(['true', 'false']);
    expect(looks[0]!.figure).not.toBe(looks[1]!.figure);
    expect(looks[0]!.paint).not.toBe(looks[1]!.paint);
    expect(looks[0]!.border).not.toBe(looks[1]!.border);
    expect(looks[0]!.background).not.toBe(looks[1]!.background);

    // All text meets 4.5:1 with a take toast and a refusal toast shown, and in the menu.
    await cellAt(page, (await readBoard(page)).find((cell) => cell.owner === 'B')!.cell).click();
    await expect(refusalToast(page)).toBeVisible();
    expect(await lowContrastText(page)).toEqual([]);
    await attachScreenshot(page, testInfo, 'dark-theme');
    await page.getByTestId('menu-button').click();
    await expect(page.getByRole('dialog', { name: 'Menu' })).toBeVisible();
    expect(await lowContrastText(page)).toEqual([]);

    // A two-player game with Player 2's seat lit, and its end screen, are readable too.
    await page.getByRole('button', { name: /^Quit to title/ }).click();
    await chooseTwoPlayers(page);
    // New game alternates the starter, so Player 1 or Player 2 opens; take until Player 2 is to move.
    do await takeGlowing(page);
    while ((await page.getByTestId('match-screen').getAttribute('data-to-move')) !== 'B');
    await expect(seat(page, 'B')).toHaveAttribute('data-lit', 'true');
    await expect(seatStatus(page, 'B')).toHaveText("Player 2's move");
    expect(await lowContrastText(page)).toEqual([]);
    for (let i = 0; i < 20 && (await page.getByTestId('end-screen').count()) === 0; i += 1) await takeGlowing(page);
    await expect(page.getByTestId('end-screen')).toBeVisible();
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

  test('[scenario:phone-layout] at 390 px the board, both seats above and below it, the Match card and the menu button fit without scrolling, and every tile and button is at least 44 px', async ({ page }, testInfo) => {
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
    await page.getByRole('button', { name: /^Versus bot/ }).tap();
    expect((await overflow(page)).x).toBeLessThanOrEqual(0);
    expect(await smallTargets(page)).toEqual([]);
    await page.getByRole('button', { name: /^Easy\b/ }).tap();
    await expect(board(page)).toBeVisible();

    // At the start: the whole table fits with no scrolling in either direction.
    const fits = ['top-bar', 'match-card', 'menu-button', 'seat-A', 'seat-B', 'avatar-A', 'avatar-B', 'seat-A-status', 'seat-B-tokens', 'board-frame', 'sitting-score'];
    expect(await overflow(page)).toEqual({ x: 0, y: 0 });
    await expectInside(page, fits);
    expect(await smallTargets(page)).toEqual([]);

    // The Match card shares the top row with the menu button; Player 2 sits above the board and Player 1 below.
    const box = async (testId: string) => (await page.getByTestId(testId).boundingBox())!;
    const [card, menu, frame, top, bottom] = await Promise.all(['match-card', 'menu-button', 'board-frame', 'seat-B', 'seat-A'].map(box));
    expect(Math.abs(card!.y + card!.height / 2 - (menu!.y + menu!.height / 2))).toBeLessThan(8);
    expect(card!.x + card!.width).toBeLessThanOrEqual(menu!.x);
    expect(top!.y + top!.height).toBeLessThanOrEqual(frame!.y);
    expect(bottom!.y).toBeGreaterThanOrEqual(frame!.y + frame!.height);
    expect(card!.y + card!.height).toBeLessThanOrEqual(top!.y);
    // No empty band: the table runs from the top row to the bottom of the screen.
    const score = await box('sitting-score');
    expect(844 - (score.y + score.height)).toBeLessThan(40);
    // The seats' text reads the same way up.
    for (const testId of ['seat-A', 'seat-B']) expect(await page.getByTestId(testId).evaluate((element) => getComputedStyle(element).transform)).toBe('none');

    // Take a tile by touch so the last tile shows its emblems; the bot replies.
    const before = await takeCount(page);
    await glowing(page).first().tap();
    await expect.poll(() => takeCount(page)).toBeGreaterThan(before);
    await waitForHumanTurn(page);
    await expect(page.getByTestId('match-card-terrain')).toBeVisible();
    expect(await overflow(page)).toEqual({ x: 0, y: 0 });
    await expectInside(page, [...fits, 'match-card-terrain', 'match-card-symbol']);
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

test('[scenario:keyboard-play] with the keyboard only, the player starts a game in each mode, opens and closes the menu and How to Play, and takes legal tiles', async ({ page }, testInfo) => {
  await openTitle(page);

  // How to Play from the title screen opens with Enter and closes with Escape.
  await tabTo(page, '[data-testid="open-how-to-play"]');
  await page.keyboard.press('Enter');
  await expect(page.getByRole('dialog', { name: 'How to play' })).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(page.getByTestId('open-how-to-play')).toBeFocused();

  // Start a bot game: New game, Versus bot, then Easy.
  await tabTo(page, '[data-testid="new-game"]', true);
  await page.keyboard.press('Enter');
  await tabTo(page, 'button[data-mode="bot"]');
  await page.keyboard.press('Enter');
  await tabTo(page, 'button[data-difficulty="easy"]');
  await page.keyboard.press('Enter');
  await expect(board(page)).toBeVisible();
  await expect(seatStatus(page, 'A')).toHaveText('Your move');

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
  await expect(cellAt(page, target)).toHaveAttribute('data-owner', 'A');
  expect(await takeCount(page)).toBe(1);
  await waitForHumanTurn(page);
  await attachScreenshot(page, testInfo, 'keyboard-play');

  // After the bot's reply, focus is still on the board: walk to a glowing tile and take it with Space.
  expect(await focusedCell(page)).toBe(target);
  const next = (await readBoard(page)).find((cell) => cell.glow)!.cell;
  await arrowTo(page, next);
  await page.keyboard.press('Space');
  await expect(cellAt(page, next)).toHaveAttribute('data-owner', 'A');
  expect(await takeCount(page)).toBeGreaterThanOrEqual(3);

  // Back to the title through the menu, then a two-player game, where the keyboard takes for both seats.
  await tabTo(page, '[data-testid="menu-button"]', true);
  await page.keyboard.press('Enter');
  await tabTo(page, '[data-testid="menu-quit"]');
  await page.keyboard.press('Enter');
  await tabTo(page, '[data-testid="new-game"]');
  await page.keyboard.press('Enter');
  await tabTo(page, 'button[data-mode="two-player"]');
  await page.keyboard.press('Enter');
  await expect(board(page)).toBeVisible();
  for (const player of ['A', 'B'] as const) {
    const number = player === 'A' ? 1 : 2;
    if ((await page.getByTestId('match-screen').getAttribute('data-to-move')) !== player) continue;
    await expect(seatStatus(page, player)).toHaveText(`Player ${number}'s move`);
  }
  const seatsTaking = [];
  for (let i = 0; i < 2; i += 1) {
    const mover = (await page.getByTestId('match-screen').getAttribute('data-to-move'))!;
    await tabTo(page, '[data-testid="board"] [data-cell]');
    const cell = (await readBoard(page)).find((candidate) => candidate.glow)!.cell;
    await arrowTo(page, cell);
    await page.keyboard.press('Enter');
    await expect(cellAt(page, cell)).toHaveAttribute('data-owner', mover);
    seatsTaking.push(mover);
  }
  expect(new Set(seatsTaking).size).toBe(2);
});
