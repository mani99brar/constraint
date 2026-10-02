/// <reference lib="dom" />
// The DOM library types the callbacks that run in the page (page.evaluate).
import { expect, test, type Page } from '@playwright/test';
import {
  attachScreenshot,
  board,
  deployFirst,
  glowing,
  lowContrastText,
  openSetup,
  openTitle,
  ownTray,
  trayTokens,
  turnNumber,
  waitForHumanTurn,
} from './helpers';

test.describe('dark colour scheme', () => {
  test.use({ colorScheme: 'dark' });

  test('[scenario:dark-theme] the board, tiles, emblems and tokens stay distinguishable and all text is readable in dark', async ({ page }, testInfo) => {
    await openTitle(page);
    expect(await lowContrastText(page)).toEqual([]);
    await page.getByTestId('title-screen').getByRole('button', { name: 'How to play' }).click();
    await expect(page.getByRole('dialog')).toBeVisible();
    expect(await lowContrastText(page)).toEqual([]);
    await page.keyboard.press('Escape');
    await page.getByTestId('title-screen').getByRole('button', { name: 'Settings' }).click();
    expect(await lowContrastText(page)).toEqual([]);
    await page.keyboard.press('Escape');

    await openSetup(page, 'Easy');
    expect(await lowContrastText(page)).toEqual([]);
    await page.getByRole('button', { name: 'Use default setup' }).click();
    await deployFirst(page);
    await waitForHumanTurn(page);

    // The dark set is in use.
    const pageBackground = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
    const [r, g, b] = pageBackground.match(/\d+/g)!.map(Number);
    expect(r! + g! + b!).toBeLessThan(120);

    // Four terrains, each with its own colour and scene; four symbols, each with its own emblem.
    const cells = await board(page)
      .locator('[data-cell]')
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
    const byTerrain = new Map(cells.map((cell) => [cell.terrain, cell]));
    expect(byTerrain.size).toBe(4);
    expect(new Set([...byTerrain.values()].map((cell) => cell.colour)).size).toBe(4);
    expect(new Set([...byTerrain.values()].map((cell) => cell.scene)).size).toBe(4);
    for (const cell of cells) {
      expect(new Set(cells.filter((other) => other.terrain === cell.terrain).map((other) => other.scene)).size).toBe(1);
      expect(new Set(cells.filter((other) => other.symbol === cell.symbol).map((other) => other.emblem)).size).toBe(1);
      expect(cell.emblemSize).toBeGreaterThanOrEqual(20);
    }
    expect(new Set(cells.map((cell) => cell.emblem)).size).toBe(4);

    // Your tokens and the bot's differ in colour, rim and name; every token shows its own emblem.
    const tokens = await page.locator('[data-testid="token"]').evaluateAll((elements) =>
      elements.map((token) => ({
        owner: token.getAttribute('data-owner'),
        rim: token.getAttribute('data-rim'),
        colour: getComputedStyle(token).backgroundColor,
        emblem: token.querySelector('svg.fighter-emblem')!.getAttribute('data-shape'),
        label: token.getAttribute('data-label')!,
      })),
    );
    const own = tokens.find((token) => token.owner === 'you')!;
    const bot = tokens.find((token) => token.owner === 'bot')!;
    expect(own.rim).not.toBe(bot.rim);
    expect(own.colour).not.toBe(bot.colour);
    expect(own.label).toMatch(/^Your /);
    expect(bot.label).toMatch(/^Bot's /);
    expect(new Set(tokens.filter((token) => token.owner === 'you').map((token) => token.emblem)).size).toBe(tokens.filter((token) => token.owner === 'you').length);

    // All text meets 4.5:1 with a token selected, a refusal toast and the event toasts shown, and in the menu.
    await trayTokens(page).first().click();
    await board(page).locator('[data-owner="B"]').click();
    await expect(page.locator('[data-testid="toast"][data-kind="refusal"]')).toBeVisible();
    expect(await lowContrastText(page)).toEqual([]);
    await attachScreenshot(page, testInfo, 'dark-theme');
    await page.getByTestId('menu-button').click();
    await expect(page.getByRole('dialog', { name: 'Menu' })).toBeVisible();
    expect(await lowContrastText(page)).toEqual([]);
  });
});

/** Every cell, token and button smaller than 44 px in either dimension. */
async function smallTargets(page: Page): Promise<string[]> {
  return page.locator('button, [role="gridcell"], [role="switch"], [data-testid="token"], [data-testid="face-down-token"]').evaluateAll((elements) =>
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

  test('[scenario:phone-layout] at 390 px the board, both trays and the top bar fit without scrolling, and every target is at least 44 px', async ({ page }, testInfo) => {
    await openTitle(page);
    expect((await overflow(page)).x).toBeLessThanOrEqual(0);
    expect(await smallTargets(page)).toEqual([]);
    await page.getByTestId('title-screen').getByRole('button', { name: 'How to play' }).tap();
    await expect(page.getByRole('dialog')).toBeVisible();
    expect(await smallTargets(page)).toEqual([]);
    await page.getByRole('button', { name: 'Close How to play' }).tap();

    await page.getByRole('button', { name: /^New game/ }).tap();
    expect((await overflow(page)).x).toBeLessThanOrEqual(0);
    await page.getByRole('button', { name: /^Easy\b/ }).tap();
    await expect(page.getByTestId('setup-board')).toBeVisible();
    expect((await overflow(page)).x).toBeLessThanOrEqual(0);
    expect(await smallTargets(page)).toEqual([]);
    await page.getByRole('button', { name: 'Use default setup' }).tap();
    await expect(board(page)).toBeVisible();

    // At the start: the whole tabletop fits with no scrolling in either direction.
    expect(await overflow(page)).toEqual({ x: 0, y: 0 });
    await expectInside(page, ['top-bar', 'bot-tray', 'board-frame', 'own-tray', 'menu-button', 'goal-chip']);
    expect(await smallTargets(page)).toEqual([]);

    // Play by touch so the constraint is set, then select a token on the board to show its buttons.
    await trayTokens(page).first().tap();
    const before = await turnNumber(page);
    await glowing(page).first().tap();
    await expect.poll(() => turnNumber(page)).toBeGreaterThan(before);
    await waitForHumanTurn(page);
    await board(page).locator('[data-owner="A"]').first().tap();
    await expect(page.getByTestId('token-actions')).toBeVisible();
    expect(await overflow(page)).toEqual({ x: 0, y: 0 });
    await expectInside(page, ['top-bar', 'bot-tray', 'board-frame', 'own-tray', 'constraint', 'recharges', 'token-actions']);
    expect(await smallTargets(page)).toEqual([]);
    await expect(ownTray(page)).toBeVisible();
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

test('[scenario:keyboard-play] with the keyboard only, the player starts a game, uses the menu and How to Play, deploys a tray token and uses an ability button', async ({ page }, testInfo) => {
  await openTitle(page);

  // Start a game: New game, Easy, default setup.
  await tabTo(page, '[data-testid="new-game"]');
  await page.keyboard.press('Enter');
  await tabTo(page, 'button[data-depth="easy"]');
  await page.keyboard.press('Enter');
  await expect(page.getByTestId('setup-board')).toBeVisible();
  await tabTo(page, '[data-testid="default-setup"]');
  await page.keyboard.press('Enter');
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

  // Select the first tray token with Tab and Space.
  const first = trayTokens(page).first();
  const fighter = (await first.getAttribute('data-fighter'))!;
  await tabTo(page, `[data-testid="own-tray"] button[data-fighter="${fighter}"]`);
  await page.keyboard.press('Space');
  await expect(first).toHaveAttribute('aria-pressed', 'true');

  // Into the board, which lands on a glowing cell; arrow keys never leave the 4×4 grid.
  await tabTo(page, '[data-testid="board"] [data-cell]', true);
  const target = (await glowing(page).first().getAttribute('data-cell'))!;
  expect(await focusedCell(page)).toBe(target);
  for (let i = 0; i < 5; i += 1) await page.keyboard.press('ArrowDown');
  for (let i = 0; i < 5; i += 1) await page.keyboard.press('ArrowRight');
  expect(await focusedCell(page)).toBe('D4');
  await page.keyboard.press('Home');
  expect(await focusedCell(page)).toBe('A1');

  // Deploy on the glowing cell with Enter.
  await arrowTo(page, target);
  await page.keyboard.press('Enter');
  await expect(board(page).locator(`[data-cell="${target}"] [data-fighter="${fighter}"]`)).toHaveCount(1);
  await expect(trayTokens(page)).toHaveCount(3);
  await waitForHumanTurn(page);

  // Select the deployed token with Enter, Tab to its ability button and press it; its targets glow.
  expect(await focusedCell(page)).toBe(target);
  await page.keyboard.press('Enter');
  await expect(board(page).locator(`[data-cell="${target}"]`)).toHaveAttribute('aria-pressed', 'true');
  await page.keyboard.press('Tab');
  const ability = page.getByTestId('token-actions').getByRole('button', { name: /ability/ });
  await expect(ability).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(ability).toHaveAttribute('aria-pressed', 'true');
  const destination = (await glowing(page).first().getAttribute('data-cell'))!;
  await attachScreenshot(page, testInfo, 'keyboard-play');

  // Back on the board, walk to a target and use the ability with Enter.
  await page.keyboard.press('Shift+Tab');
  expect(await focusedCell(page)).toBe(target);
  const turn = await turnNumber(page);
  await arrowTo(page, destination);
  await page.keyboard.press('Enter');
  await expect.poll(() => turnNumber(page)).toBe(turn + 1);
  await expect(board(page).locator(`[data-cell="${destination}"] [data-fighter="${fighter}"]`)).toHaveCount(1);
  await expect(board(page).locator(`[data-cell="${destination}"] [data-testid="token"]`)).toHaveAttribute('data-charge', '0');
});
