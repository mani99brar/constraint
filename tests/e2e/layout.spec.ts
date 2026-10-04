/// <reference lib="dom" />
// The DOM library types the callbacks that run in the page (page.evaluate).
import { expect, test, type Page, type TestInfo } from '@playwright/test';
import {
  attachScreenshot,
  board,
  cellAt,
  chooseDifficulty,
  chooseTwoPlayers,
  difficultySwitch,
  frameStripe,
  glowing,
  lowContrastText,
  nearWin,
  openHome,
  seedSavedGame,
  gameLogOfState,
  takeToast,
  toastsOverCells,
  readBoard,
  refusalToast,
  seat,
  seatStatus,
  takeCount,
  takeGlowing,
  waitForHumanTurn,
} from './helpers';

/** The tiles, tokens, avatars and seats of the game on screen, read from the page, for the theme checks. */
async function expectDistinguishable(page: Page) {
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

  // The material surfaces: felt under the table, wood grain on the frame, tiles with depth, bevelled tokens.
  const materials = await page.evaluate(() => {
    const style = (selector: string) => getComputedStyle(document.querySelector(selector)!);
    return {
      felt: style('[data-testid="match-screen"]').backgroundImage,
      wood: style('[data-testid="board-frame"]').backgroundImage,
      woodColour: style('[data-testid="board-frame"]').backgroundColor,
      feltColour: style('[data-testid="match-screen"]').backgroundColor,
      token: style('[data-testid="board"] [data-testid="token"]').backgroundImage,
    };
  });
  expect(materials.felt).toMatch(/radial-gradient/);
  expect(materials.wood).toMatch(/repeating-linear-gradient/);
  expect(materials.token).toMatch(/radial-gradient/);
  expect(materials.woodColour).not.toBe(materials.feltColour);
}

/**
 * Walks the home screen, its dialogs, a bot game with both toasts and the menu, the home screen with a
 * saved game, and a two-player game with Player 2 lit to its end, checking every text for 4.5:1 against
 * its material and that the pieces stay distinguishable. Attaches the screenshot `id` in the bot game.
 */
async function readableThroughout(page: Page, testInfo: TestInfo, id: string) {
  await page.getByTestId('home-screen').getByRole('button', { name: 'How to play' }).click();
  await expect(page.getByRole('dialog')).toBeVisible();
  expect(await lowContrastText(page)).toEqual([]);
  await page.keyboard.press('Escape');
  await page.getByTestId('home-screen').getByRole('button', { name: 'Settings' }).click();
  expect(await lowContrastText(page)).toEqual([]);
  await page.keyboard.press('Escape');

  await chooseDifficulty(page, 'Easy');
  expect(await lowContrastText(page)).toEqual([]);
  await takeGlowing(page);
  await waitForHumanTurn(page);
  await expectDistinguishable(page);

  // All text meets 4.5:1 with a take toast and a refusal toast shown, and in the menu.
  await cellAt(page, (await readBoard(page)).find((cell) => cell.owner === 'B')!.cell).click();
  await expect(refusalToast(page)).toBeVisible();
  expect(await lowContrastText(page)).toEqual([]);
  await attachScreenshot(page, testInfo, id);
  await page.getByTestId('menu-button').click();
  await expect(page.getByRole('dialog', { name: 'Menu' })).toBeVisible();
  expect(await lowContrastText(page)).toEqual([]);

  // A two-player game with Player 2's seat lit, and its end screen, are readable too.
  await page.getByRole('button', { name: /^Quit to title/ }).click();
  // With a saved game the home screen and its notes are readable too.
  await expect(page.getByTestId('continue')).toBeVisible();
  expect(await lowContrastText(page)).toEqual([]);
  await chooseTwoPlayers(page);
  // A new game alternates the starter, so Player 1 or Player 2 opens; take until Player 2 is to move.
  do await takeGlowing(page);
  while ((await page.getByTestId('match-screen').getAttribute('data-to-move')) !== 'B');
  await expect(seat(page, 'B')).toHaveAttribute('data-lit', 'true');
  await expect(seatStatus(page, 'B')).toHaveText("Player 2's move");
  expect(await lowContrastText(page)).toEqual([]);
  for (let i = 0; i < 20 && (await page.getByTestId('end-screen').count()) === 0; i += 1) await takeGlowing(page);
  await expect(page.getByTestId('end-screen')).toBeVisible();
  expect(await lowContrastText(page)).toEqual([]);
}

test.describe('dark colour scheme', () => {
  test.use({ colorScheme: 'dark' });

  test('[scenario:dark-theme] on the home screen and in a game the board, tiles, emblems, both players’ tokens, both avatars, the materials and the lit and dimmed seats stay distinguishable and all text is readable in dark', async ({ page }, testInfo) => {
    await openHome(page);
    // The dark set is in use, on its own felt.
    const pageBackground = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
    const [r, g, b] = pageBackground.match(/\d+/g)!.map(Number);
    expect(r! + g! + b!).toBeLessThan(120);
    await readableThroughout(page, testInfo, 'dark-theme');
  });
});

test.describe('light colour scheme', () => {
  test.use({ colorScheme: 'light' });

  test('[scenario:light-theme] on the home screen and in a game all text, the seat labels on lit and dimmed seats and the play cards included, meets 4.5:1, and both players’ tokens and avatars stay distinguishable in light', async ({ page }, testInfo) => {
    await openHome(page);
    // The light set is in use.
    const pageBackground = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
    const [r, g, b] = pageBackground.match(/\d+/g)!.map(Number);
    expect(r! + g! + b!).toBeGreaterThan(600);
    // The play cards and the results strip are cards over the felt, each with its gradient read by the check.
    for (const id of ['card-bot', 'card-two', 'results']) expect(await page.getByTestId(id).evaluate((element) => getComputedStyle(element).backgroundImage)).toMatch(/linear-gradient/);
    await readableThroughout(page, testInfo, 'light-theme');
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

  test('[scenario:phone-layout] at 390 × 844 the home screen fits across, the game fits with no scrolling with nameplates at most 96 px tall, Player 2 above the board and Player 1 below, the end state with a toast fits too, and every tile and button is at least 44 px', async ({ page }, testInfo) => {
    test.setTimeout(90_000);
    const ending = nearWin('B');
    await seedSavedGame(page, ending.state, 'bot');
    await openHome(page);

    // The home screen: the hero, Continue, both play cards, the results strip, How to play and Settings fit across.
    const home = ['hero', 'title', 'hero-board', 'hero-avatar-A', 'hero-avatar-B', 'continue', 'card-bot', 'card-two', 'difficulty-switch', 'play-bot', 'play-two', 'results', 'open-how-to-play', 'open-settings'];
    expect((await overflow(page)).x).toBeLessThanOrEqual(0);
    await expectInsideAcross(page, home);
    expect(await smallTargets(page)).toEqual([]);
    await page.getByTestId('home-screen').getByRole('button', { name: 'How to play' }).tap();
    await expect(page.getByRole('dialog')).toBeVisible();
    expect((await overflow(page)).x).toBeLessThanOrEqual(0);
    expect(await smallTargets(page)).toEqual([]);
    await page.getByRole('button', { name: 'Close How to play' }).tap();

    // A game: the whole table fits with no scrolling in either direction.
    await difficultySwitch(page).getByRole('radio', { name: 'Easy' }).tap();
    await page.getByTestId('play-bot').tap();
    await expect(board(page)).toBeVisible();
    const fits = ['top-bar', 'match-card', 'menu-button', 'seat-A', 'seat-B', 'avatar-A', 'avatar-B', 'seat-A-status', 'seat-B-tokens', 'board-frame', 'toasts', 'sitting-score'];
    expect(await overflow(page)).toEqual({ x: 0, y: 0 });
    await expectInside(page, fits);
    expect(await smallTargets(page)).toEqual([]);
    await expectNameplates(page);

    // The frame's stripe sits on the mover's side: below the board for Player 1, above it for Player 2.
    const p1 = await seat(page, 'A').evaluate((element) => getComputedStyle(element).borderTopColor);
    expect(await frameStripe(page)).toEqual({ side: 'bottom', color: p1 });

    // Take a tile by touch so the last tile shows its emblems; while the bot thinks, the stripe moves above
    // the board, and then the bot replies.
    const before = await takeCount(page);
    await glowing(page).first().tap();
    await expect.poll(async () => (await frameStripe(page)).side, { intervals: [25], timeout: 2_000 }).toBe('top');
    await expect.poll(() => takeCount(page)).toBeGreaterThan(before);
    await waitForHumanTurn(page);
    await expect(page.getByTestId('match-card-terrain')).toBeVisible();
    expect(await overflow(page)).toEqual({ x: 0, y: 0 });
    await expectInside(page, [...fits, 'match-card-terrain', 'match-card-symbol']);
    expect(await smallTargets(page)).toEqual([]);
    await expectNameplates(page);
    await attachScreenshot(page, testInfo, 'phone-layout');

    // The menu fits too.
    await page.getByTestId('menu-button').tap();
    await expect(page.getByRole('dialog', { name: 'Menu' })).toBeVisible();
    expect((await overflow(page)).x).toBeLessThanOrEqual(0);
    expect(await smallTargets(page)).toEqual([]);

    // The end state: Continue a saved game where the bot wins with its next take. The end card and the
    // bot's take toast show, and everything still fits with no scrolling, every tile at least 44 px.
    await page.getByRole('button', { name: /^Quit to title/ }).tap();
    await page.evaluate((log) => window.localStorage.setItem('okiya.saved-match', log), JSON.stringify({ version: 3, mode: 'bot', difficulty: 'easy', score: { A: 0, B: 0, draws: 0 }, log: gameLogOfState(ending.state) }));
    await page.reload();
    await page.getByTestId('continue').tap();
    await expect(page.getByTestId('end-screen')).toBeVisible({ timeout: 11_000 });
    await expect(takeToast(page)).toBeVisible();
    expect(await overflow(page)).toEqual({ x: 0, y: 0 });
    await expectInside(page, ['top-bar', 'seat-A', 'seat-B', 'board-frame', 'toasts', 'sitting-score', 'end-screen', 'play-again', 'end-title']);
    expect(await smallTargets(page)).toEqual([]);
    expect(await toastsOverCells(page)).toEqual([]);
    await expectNameplates(page);
  });
});

/** At most 96 px tall, Player 2's nameplate above the board and Player 1's below, the Match card and menu on top. */
async function expectNameplates(page: Page) {
  const box = async (testId: string) => (await page.getByTestId(testId).boundingBox())!;
  const [card, menu, frame, top, bottom] = await Promise.all(['match-card', 'menu-button', 'board-frame', 'seat-B', 'seat-A'].map(box));
  for (const plate of [top!, bottom!]) expect(plate.height).toBeLessThanOrEqual(96);
  expect(Math.abs(card!.y + card!.height / 2 - (menu!.y + menu!.height / 2))).toBeLessThan(8);
  expect(card!.x + card!.width).toBeLessThanOrEqual(menu!.x);
  expect(top!.y + top!.height).toBeLessThanOrEqual(frame!.y);
  expect(bottom!.y).toBeGreaterThanOrEqual(frame!.y + frame!.height);
  expect(card!.y + card!.height).toBeLessThanOrEqual(top!.y);
  // The nameplates' text reads the same way up.
  for (const testId of ['seat-A', 'seat-B']) expect(await page.getByTestId(testId).evaluate((element) => getComputedStyle(element).transform)).toBe('none');
}

/** Each element lies across the viewport's width, with nothing cut off at either side. */
async function expectInsideAcross(page: Page, testIds: readonly string[]) {
  const { width } = page.viewportSize()!;
  for (const testId of testIds) {
    const box = (await page.getByTestId(testId).boundingBox())!;
    expect(box, testId).not.toBeNull();
    expect(box.x, testId).toBeGreaterThanOrEqual(0);
    expect(box.x + box.width, testId).toBeLessThanOrEqual(width);
  }
}

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

test('[scenario:keyboard-play] with the keyboard only, the player changes the difficulty switch, starts a game in each mode from the home screen, opens and closes the menu and How to Play, and takes legal tiles', async ({ page }, testInfo) => {
  await openHome(page);

  // How to Play from the title screen opens with Enter and closes with Escape.
  await tabTo(page, '[data-testid="open-how-to-play"]');
  await page.keyboard.press('Enter');
  await expect(page.getByRole('dialog', { name: 'How to play' })).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(page.getByTestId('open-how-to-play')).toBeFocused();

  // The difficulty switch is one Tab stop, on the chosen key; the arrow keys move and select, wrapping round.
  await tabTo(page, '[data-testid="difficulty-switch"] [role="radio"]', true);
  await expect(difficultySwitch(page).getByRole('radio', { name: 'Normal' })).toBeFocused();
  await page.keyboard.press('ArrowRight');
  await expect(difficultySwitch(page).getByRole('radio', { name: 'Hard' })).toBeFocused();
  await expect(difficultySwitch(page).getByRole('radio', { name: 'Hard' })).toHaveAttribute('aria-checked', 'true');
  await page.keyboard.press('ArrowRight');
  await expect(difficultySwitch(page).getByRole('radio', { name: 'Easy' })).toHaveAttribute('aria-checked', 'true');
  await expect(difficultySwitch(page).getByRole('radio', { name: 'Easy' })).toBeFocused();
  await expect(difficultySwitch(page).locator('[role="radio"][tabindex="0"]')).toHaveCount(1);

  // Start a bot game at Easy: Tab to its Play, then Enter.
  await page.keyboard.press('Tab');
  await expect(page.getByTestId('play-bot')).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(board(page)).toBeVisible();
  await expect(page.getByTestId('seat-B-name')).toHaveText('Bot · Easy');
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

  // Back home through the menu, then a two-player game, where the keyboard takes for both seats.
  await tabTo(page, '[data-testid="menu-button"]', true);
  await page.keyboard.press('Enter');
  await tabTo(page, '[data-testid="menu-quit"]');
  await page.keyboard.press('Enter');
  await tabTo(page, '[data-testid="play-two"]');
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
