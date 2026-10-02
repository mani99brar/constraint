/// <reference lib="dom" />
// The DOM library types the callbacks that run in the page (page.evaluate).
import { expect, test, type Page } from '@playwright/test';
import { attachScreenshot, deployFirst, lowContrastText, openSetup, openTitle, startMatch, waitForHumanTurn } from './helpers';

test.describe('dark colour scheme', () => {
  test.use({ colorScheme: 'dark' });

  test('[scenario:dark-theme] the board, terrain, symbols, tokens and all text stay distinguishable and readable in dark', async ({ page }, testInfo) => {
    await openTitle(page);
    expect(await lowContrastText(page)).toEqual([]);
    await page.getByTestId('title-screen').getByRole('button', { name: 'How to play' }).click();
    await expect(page.getByRole('dialog')).toBeVisible();
    expect(await lowContrastText(page)).toEqual([]);
    await page.keyboard.press('Escape');

    await openSetup(page, 'Easy');
    expect(await lowContrastText(page)).toEqual([]);
    await page.getByRole('button', { name: 'Use default setup' }).click();
    await deployFirst(page);
    await expect(page.getByTestId('log').locator('li')).toHaveCount(2);
    await waitForHumanTurn(page);

    // The dark set is in use.
    const pageBackground = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
    const [r, g, b] = pageBackground.match(/\d+/g)!.map(Number);
    expect(r! + g! + b!).toBeLessThan(120);

    // Four terrains, each with its own colour, shape and label; four symbols with their own shape and label.
    const cells = page.getByTestId('board').locator('[data-cell]');
    const terrains = await cells.evaluateAll((elements) =>
      elements.map((cell) => ({
        terrain: cell.getAttribute('data-terrain')!,
        symbol: cell.getAttribute('data-symbol')!,
        colour: getComputedStyle(cell).backgroundColor,
        terrainShape: cell.querySelector('.terrain svg')!.getAttribute('data-shape'),
        terrainLabel: cell.querySelector('.terrain')!.textContent,
        symbolShape: cell.querySelector('.symbol svg')!.getAttribute('data-shape'),
        symbolLabel: cell.querySelector('.symbol')!.textContent,
      })),
    );
    const byTerrain = new Map(terrains.map((cell) => [cell.terrain, cell]));
    expect(byTerrain.size).toBe(4);
    expect(new Set([...byTerrain.values()].map((cell) => cell.colour)).size).toBe(4);
    expect(new Set([...byTerrain.values()].map((cell) => cell.terrainShape)).size).toBe(4);
    for (const cell of terrains) {
      expect(cell.terrainLabel).toBe(cell.terrain);
      expect(cell.symbolLabel).toBe(cell.symbol);
    }
    expect(new Set(terrains.map((cell) => cell.symbolShape)).size).toBe(4);

    // Your tokens and the bot's differ in shape, colour and label.
    const tokens = await page.getByTestId('board').locator('.token').evaluateAll((elements) =>
      elements.map((token) => ({
        own: token.classList.contains('own'),
        shape: token.querySelector('.token-badge')!.getAttribute('data-shape'),
        colour: getComputedStyle(token.querySelector('.token-badge')!).backgroundColor,
        label: token.querySelector('.token-side')!.firstChild!.textContent,
      })),
    );
    const own = tokens.find((token) => token.own)!;
    const enemy = tokens.find((token) => !token.own)!;
    expect(own.shape).not.toBe(enemy.shape);
    expect(own.colour).not.toBe(enemy.colour);
    expect([own.label, enemy.label]).toEqual(['You', 'Bot']);

    // All text meets 4.5:1 against its background, with a fighter selected and a refusal shown.
    await page.getByTestId('reserve').getByRole('button').first().click();
    await page.getByTestId('board').locator('[data-cell="B2"]').click();
    expect(await lowContrastText(page)).toEqual([]);

    await attachScreenshot(page, testInfo, 'dark-theme');
  });
});

/** Every button and board cell smaller than 44 px in either dimension. */
async function smallTargets(page: Page): Promise<string[]> {
  return page.locator('button, [role="gridcell"], [role="switch"]').evaluateAll((elements) =>
    elements.flatMap((element) => {
      const rect = element.getBoundingClientRect();
      if (rect.width === 0 && rect.height === 0) return [];
      return rect.width < 44 || rect.height < 44 ? [`${element.textContent!.trim().slice(0, 20)}: ${rect.width}×${rect.height}`] : [];
    }),
  );
}

async function horizontalOverflow(page: Page): Promise<number> {
  return page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
}

async function expectFits(page: Page) {
  expect(await horizontalOverflow(page)).toBeLessThanOrEqual(0);
  expect(await smallTargets(page)).toEqual([]);
}

test.describe('phone viewport', () => {
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });

  test('[scenario:phone-layout] the title screen, board, constraint and controls fit a 390 px phone', async ({ page }, testInfo) => {
    await openTitle(page);
    await expectFits(page);
    await page.getByTestId('title-screen').getByRole('button', { name: 'How to play' }).tap();
    await expect(page.getByRole('dialog')).toBeVisible();
    await expectFits(page);
    await page.getByRole('button', { name: 'Close How to play' }).tap();

    await page.getByRole('button', { name: /^New game/ }).tap();
    await expectFits(page);
    await page.getByRole('button', { name: /^Easy\b/ }).tap();
    await expect(page.getByTestId('setup-board')).toBeVisible();
    await expectFits(page);
    await page.getByRole('button', { name: 'Use default setup' }).tap();
    await expect(page.getByTestId('board')).toBeVisible();

    // Play a turn by touch so the constraint is set and both sides have a token.
    await page.getByTestId('reserve').getByRole('button').first().tap();
    await page.locator('[data-testid="board"] [data-highlighted="true"]').first().tap();
    await expect(page.getByTestId('log').locator('li')).toHaveCount(2);
    await waitForHumanTurn(page);
    await page.getByTestId('reserve').getByRole('button').first().tap();

    const width = page.viewportSize()!.width;
    for (const testId of ['board', 'constraint', 'turn-prompt', 'actions', 'reserve', 'settings']) {
      const box = (await page.getByTestId(testId).boundingBox())!;
      expect(box.x, testId).toBeGreaterThanOrEqual(0);
      expect(box.x + box.width, testId).toBeLessThanOrEqual(width);
    }
    await expectFits(page);
    await attachScreenshot(page, testInfo, 'phone-layout');
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

test('[scenario:keyboard-play] with the keyboard only, the player starts a game, opens and closes How to Play, and deploys', async ({ page }, testInfo) => {
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

  // How to Play opens with Enter, closes with Escape, and focus comes back.
  await tabTo(page, '[data-testid="match-how-to-play"]');
  await page.keyboard.press('Enter');
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(page.getByTestId('match-how-to-play')).toBeFocused();

  // Select the second reserve fighter with Tab and Space.
  const second = page.getByTestId('reserve').getByRole('button').nth(1);
  const fighter = (await second.getAttribute('data-fighter'))!;
  const name = (await second.textContent())!;
  await tabTo(page, `[data-testid="reserve"] button[data-fighter="${fighter}"]`);
  await page.keyboard.press('Space');
  await expect(second).toHaveAttribute('aria-pressed', 'true');

  // Into the board, then around it: arrow keys never leave the 4×4 grid.
  await tabTo(page, '[data-testid="board"] [data-cell]', true);
  for (let i = 0; i < 5; i += 1) await page.keyboard.press('ArrowUp');
  for (let i = 0; i < 5; i += 1) await page.keyboard.press('ArrowLeft');
  expect(await focusedCell(page)).toBe('A1');
  for (let i = 0; i < 5; i += 1) await page.keyboard.press('ArrowRight');
  for (let i = 0; i < 5; i += 1) await page.keyboard.press('ArrowDown');
  expect(await focusedCell(page)).toBe('D4');
  await page.keyboard.press('Home');
  expect(await focusedCell(page)).toBe('A1');

  // Walk to a highlighted cell and deploy there with Enter.
  const target = page.locator('[data-testid="board"] [data-highlighted="true"]').last();
  const cell = (await target.getAttribute('data-cell'))!;
  const row = Number(await target.getAttribute('data-row'));
  const column = Number(await target.getAttribute('data-column'));
  for (let i = 0; i < row; i += 1) await page.keyboard.press('ArrowDown');
  for (let i = 0; i < column; i += 1) await page.keyboard.press('ArrowRight');
  expect(await focusedCell(page)).toBe(cell);
  await page.keyboard.press('Enter');

  await expect(page.locator(`[data-testid="board"] [data-cell="${cell}"]`)).toHaveAttribute('data-owner', 'A');
  await expect(page.getByTestId('log').locator('li').first()).toHaveText(`Turn 1 · You: deploy ${name} at ${cell}`);
  await expect(page.getByTestId('log').locator('li')).toHaveCount(2);

  await attachScreenshot(page, testInfo, 'keyboard-play');
});
