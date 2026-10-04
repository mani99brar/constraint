/// <reference lib="dom" />
// The DOM library types the callbacks that run in the page (page.evaluate).
import { expect, test, type Page, type TestInfo } from '@playwright/test';
import type { PaletteId } from '../../apps/web/src/theme';
import {
  attachScreenshot,
  board,
  cellAt,
  chooseDifficulty,
  chooseTwoPlayers,
  difficultySwitch,
  opponentSwitch,
  playButton,
  glowing,
  lowContrastText,
  nearEnding,
  nearWin,
  continueSaved,
  PALETTES,
  seededPosition,
  setPalette,
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

  // The material surfaces: the calm ground under the table, wood grain on the frame, tiles with depth, bevelled tokens.
  const materials = await page.evaluate(() => {
    const style = (selector: string) => getComputedStyle(document.querySelector(selector)!);
    return {
      ground: style('[data-testid="match-screen"]').backgroundImage,
      wood: style('[data-testid="board-frame"]').backgroundImage,
      woodColour: style('[data-testid="board-frame"]').backgroundColor,
      groundColour: style('[data-testid="match-screen"]').backgroundColor,
      token: style('[data-testid="board"] [data-testid="token"]').backgroundImage,
    };
  });
  expect(materials.ground).toMatch(/radial-gradient/);
  expect(materials.ground).not.toMatch(/repeating-|linear-gradient/);
  expect(materials.wood).toMatch(/repeating-linear-gradient/);
  expect(materials.token).toMatch(/radial-gradient/);
  expect(materials.woodColour).not.toBe(materials.groundColour);
  // The tiles stand apart from the board's well, and the plates and the scoreboard stand apart from the ground.
  const plates = await page.evaluate(() => ['[data-testid="seat-A"]', '[data-testid="seat-B"]', '[data-testid="score-A"]', '[data-testid="score-B"]', '[data-testid="match-card"]'].map((selector) => getComputedStyle(document.querySelector(selector)!).backgroundColor));
  for (const plate of plates) expect(plate).not.toBe(materials.groundColour);
  const well = await board(page).evaluate((element) => getComputedStyle(element).backgroundColor);
  for (const cell of byTerrain.values()) expect(cell.colour).not.toBe(well);
}

/**
 * Walks the home screen, its dialogs, a bot game with both toasts, every tile's name plate and the menu,
 * the home screen with a saved game, and a two-player game with Player 2 lit to its end and its result
 * card, checking every text for 4.5:1 against the worst colour behind it and that the pieces stay
 * distinguishable. Attaches the screenshot `id` in the bot game.
 */
async function readableThroughout(page: Page, testInfo: TestInfo, id: string) {
  expect(await lowContrastText(page)).toEqual([]);
  await page.getByTestId('home-screen').getByRole('button', { name: 'How to play' }).click();
  await expect(page.getByRole('dialog')).toBeVisible();
  expect(await lowContrastText(page)).toEqual([]);
  await page.keyboard.press('Escape');
  // The Tile names setting on, so every free tile's name plate is checked in the game below.
  await page.getByTestId('home-screen').getByRole('button', { name: 'Settings' }).click();
  await page.getByRole('switch', { name: 'Tile names' }).click();
  expect(await lowContrastText(page)).toEqual([]);
  await page.keyboard.press('Escape');

  await chooseDifficulty(page, 'Easy');
  expect(await lowContrastText(page)).toEqual([]);
  await takeGlowing(page);
  await waitForHumanTurn(page);
  await expectDistinguishable(page);
  // Every free tile shows its name, on a plate that reads.
  expect(await page.locator('[data-testid="board"] .tile-name').evaluateAll((plates) => plates.filter((plate) => getComputedStyle(plate).display !== 'none').length)).toBe(14);

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
  await expect(page.getByTestId('scoreboard')).toBeVisible();
  expect(await lowContrastText(page)).toEqual([]);
}

/** The page ground's channels, for telling a light ground from a dark one. */
async function groundChannels(page: Page) {
  return (await page.evaluate(() => getComputedStyle(document.body).backgroundColor)).match(/\d+/g)!.slice(0, 3).map(Number) as [number, number, number];
}

/**
 * The other colour themes on seeded positions, switched in place rather than replayed: the home screen and
 * Settings, a bot game after two takes with tile names on (a refusal toast and the menu shown), and a
 * two-player game's end with its result card, each read for 4.5:1 and the pieces kept distinguishable.
 */
async function readableInPalette(page: Page, palette: PaletteId, scheme: 'light' | 'dark') {
  const where = `${palette} ${scheme}`;
  await continueSaved(page, seededPosition(2), 'bot');
  await setPalette(page, palette);
  const [r, g, b] = await groundChannels(page);
  if (scheme === 'dark') expect(r + g + b, where).toBeLessThan(120);
  else expect(r + g + b, where).toBeGreaterThan(600);
  expect(await lowContrastText(page), where).toEqual([]);
  await expectDistinguishable(page);
  await cellAt(page, (await readBoard(page)).find((cell) => cell.owner === 'B')!.cell).click();
  await expect(refusalToast(page)).toBeVisible();
  expect(await lowContrastText(page), where).toEqual([]);
  await page.getByTestId('menu-button').click();
  await expect(page.getByRole('dialog', { name: 'Menu' })).toBeVisible();
  expect(await lowContrastText(page), where).toEqual([]);
  await page.getByRole('button', { name: /^Quit to title/ }).click();
  await expect(page.getByTestId('home-screen')).toBeVisible();
  expect(await lowContrastText(page), where).toEqual([]);
  await page.getByTestId('open-settings').click();
  expect(await lowContrastText(page), where).toEqual([]);
  await page.keyboard.press('Escape');
  // A two-player game's end, Player 2 lit before the ending take.
  const { state, ends } = nearEnding('shape', 'B');
  await continueSaved(page, state, 'two-player');
  await setPalette(page, palette);
  await expect(seat(page, 'B')).toHaveAttribute('data-lit', 'true');
  expect(await lowContrastText(page), where).toEqual([]);
  await cellAt(page, ends[0]!).click();
  await expect(page.getByTestId('end-screen')).toBeVisible();
  expect(await lowContrastText(page), where).toEqual([]);
}

test.describe('dark colour scheme', () => {
  test.use({ colorScheme: 'dark' });

  test('[scenario:dark-theme] for each colour theme in dark, on the home screen and in a game, the ground, board, tiles, emblems, both players’ tokens, both avatars and the lit and dimmed nameplates stay distinguishable, and all text, the name plates, the scoreboard and the result card included, reads at 4.5:1', async ({ page }, testInfo) => {
    test.setTimeout(180_000);
    await openHome(page);
    // The default theme's dark set is in use, on its warm charcoal ground.
    await expect(page.locator('html')).toHaveAttribute('data-palette', 'walnut');
    const [r, g, b] = await groundChannels(page);
    expect(r + g + b).toBeLessThan(120);
    expect(r).toBeGreaterThanOrEqual(b);
    await readableThroughout(page, testInfo, 'dark-theme');
    for (const palette of PALETTES.filter((id) => id !== 'walnut')) await readableInPalette(page, palette, 'dark');
  });
});

test.describe('light colour scheme', () => {
  test.use({ colorScheme: 'light' });

  test('[scenario:light-theme] for each colour theme in light, on the home screen and in a game, all text, the play panel, the nameplates, the scoreboard, the name plates and the result card included, meets 4.5:1, and both players’ tokens and avatars stay distinguishable', async ({ page }, testInfo) => {
    test.setTimeout(180_000);
    await openHome(page);
    // The default theme's light set is in use, on its parchment ground.
    await expect(page.locator('html')).toHaveAttribute('data-palette', 'walnut');
    const pageBackground = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
    const [r, g, b] = await groundChannels(page);
    expect(r + g + b).toBeGreaterThan(600);
    expect(r).toBeGreaterThan(b);
    // The play panel is a card over the ground with its gradient read by the check; the results line sits on a solid plate.
    expect(await page.getByTestId('play-panel').evaluate((element) => getComputedStyle(element).backgroundImage)).toMatch(/linear-gradient/);
    expect(await page.getByTestId('results').evaluate((element) => getComputedStyle(element).backgroundColor)).not.toBe(pageBackground);
    await readableThroughout(page, testInfo, 'light-theme');
    for (const palette of PALETTES.filter((id) => id !== 'walnut')) await readableInPalette(page, palette, 'light');
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

/**
 * The empty strips across the game's column, mid-game: between consecutive elements that paint something
 * (text, a background, a border or a drawing; a transparent wrapper or an empty toast slot is not content),
 * the top and the bottom of the screen included. Returns their heights, top first, and the bottom one.
 */
async function emptyStrips(page: Page): Promise<{ strips: number[]; bottom: number }> {
  return page.evaluate(() => {
    const screen = document.querySelector('[data-testid="match-screen"]')!;
    const paints = (element: Element) => {
      const style = getComputedStyle(element);
      const box = element.getBoundingClientRect();
      if (style.display === 'none' || style.visibility === 'hidden' || Number(style.opacity) === 0 || box.width === 0 || box.height === 0 || element.closest('.visually-hidden')) return false;
      const text = [...element.childNodes].some((node) => node.nodeType === Node.TEXT_NODE && node.textContent!.trim() !== '');
      const background = style.backgroundColor !== 'rgba(0, 0, 0, 0)' || style.backgroundImage !== 'none';
      const border = parseFloat(style.borderTopWidth) > 0 && style.borderTopStyle !== 'none';
      return text || background || border || element instanceof SVGElement;
    };
    const spans = [...screen.querySelectorAll('*')]
      .filter(paints)
      .map((element) => element.getBoundingClientRect())
      .map((box) => [Math.max(0, box.top), Math.min(window.innerHeight, box.bottom)] as const)
      .sort((a, b) => a[0] - b[0]);
    const strips: number[] = [];
    let reached = 0;
    for (const [top, bottom] of spans) {
      if (top > reached) strips.push(top - reached);
      reached = Math.max(reached, bottom);
    }
    strips.push(window.innerHeight - reached);
    return { strips, bottom: window.innerHeight - reached };
  });
}

/** Mid-game with no toast: no empty strip over 56 px anywhere in the column, and at most 48 px at the bottom. */
async function expectNoEmptyBand(page: Page) {
  const { strips, bottom } = await emptyStrips(page);
  expect(Math.max(...strips), JSON.stringify(strips)).toBeLessThanOrEqual(56);
  expect(bottom).toBeLessThanOrEqual(48);
}

test.describe('phone viewport', () => {
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });

  test('[scenario:phone-layout] at 390 × 844 the home screen fits without scrolling; in the game the scoreboard row is the top row with the menu at its end, Player 2 above the board and Player 1 below, no empty strip over 56 px and at most 48 px at the bottom mid-game, no scrolling mid-game or with the end card shown, every tile and button at least 44 px', async ({ page }, testInfo) => {
    test.setTimeout(90_000);
    const ending = nearWin('B');
    await seedSavedGame(page, ending.state, 'bot');
    await openHome(page);

    // The home screen: the hero, Continue, the play panel, the results line, How to play and Settings fit with no scrolling.
    const home = ['hero', 'title', 'hero-board', 'hero-avatar-A', 'hero-avatar-B', 'continue', 'play-panel', 'opponent-switch', 'difficulty-switch', 'play', 'results', 'open-how-to-play', 'open-settings'];
    expect(await overflow(page)).toEqual({ x: 0, y: 0 });
    await expectInside(page, home);
    expect(await smallTargets(page)).toEqual([]);
    await page.getByTestId('home-screen').getByRole('button', { name: 'How to play' }).tap();
    await expect(page.getByRole('dialog')).toBeVisible();
    expect((await overflow(page)).x).toBeLessThanOrEqual(0);
    expect(await smallTargets(page)).toEqual([]);
    await page.getByRole('button', { name: 'Close How to play' }).tap();

    // A game: the whole table fits with no scrolling in either direction and no empty band at the bottom.
    await difficultySwitch(page).getByRole('radio', { name: 'Easy' }).tap();
    await playButton(page).tap();
    await expect(board(page)).toBeVisible();
    const fits = ['top-bar', 'scoreboard', 'score-A', 'score-B', 'match-card', 'menu-button', 'seat-A', 'seat-B', 'avatar-A', 'avatar-B', 'seat-A-status', 'seat-B-tokens', 'board-frame'];
    expect(await overflow(page)).toEqual({ x: 0, y: 0 });
    await expectInside(page, fits);
    expect(await smallTargets(page)).toEqual([]);
    await expectNameplates(page);
    await expectNoEmptyBand(page);
    // The height went to the elements: about 80 px avatars and a 64 px Match card.
    expect((await page.getByTestId('avatar-A').boundingBox())!.width).toBeGreaterThanOrEqual(76);
    expect((await page.getByTestId('match-card').boundingBox())!.height).toBeCloseTo(64, 0);

    // Take a tile by touch so the last tile shows its emblems, and the bot replies. Mid-game with no toast,
    // still no scrolling and no empty band.
    const before = await takeCount(page);
    await glowing(page).first().tap();
    await expect.poll(() => takeCount(page)).toBeGreaterThan(before);
    await waitForHumanTurn(page);
    await expect(page.getByTestId('match-card-terrain')).toBeVisible();
    expect(await overflow(page)).toEqual({ x: 0, y: 0 });
    await expectInside(page, [...fits, 'match-card-terrain', 'match-card-symbol']);
    expect(await smallTargets(page)).toEqual([]);
    await expectNameplates(page);
    await expect(page.getByTestId('toast')).toHaveCount(0, { timeout: 6_000 });
    await expectNoEmptyBand(page);
    await attachScreenshot(page, testInfo, 'phone-layout');

    // The menu fits too.
    await page.getByTestId('menu-button').tap();
    await expect(page.getByRole('dialog', { name: 'Menu' })).toBeVisible();
    expect((await overflow(page)).x).toBeLessThanOrEqual(0);
    expect(await smallTargets(page)).toEqual([]);

    // The end state: Continue a saved game where the bot wins with its next take. The board shrinks and the
    // result card sits under Player 1's nameplate, and everything fits with no scrolling and no toast.
    await page.getByRole('button', { name: /^Quit to title/ }).tap();
    await page.evaluate((log) => window.localStorage.setItem('okiya.saved-match', log), JSON.stringify({ version: 3, mode: 'bot', difficulty: 'easy', score: { A: 0, B: 0, draws: 0 }, log: gameLogOfState(ending.state) }));
    await page.reload();
    await page.getByTestId('continue').tap();
    await expect(page.getByTestId('end-screen')).toBeVisible({ timeout: 11_000 });
    expect(await overflow(page)).toEqual({ x: 0, y: 0 });
    await expectInside(page, ['top-bar', 'seat-A', 'seat-B', 'scoreboard', 'board-frame', 'end-screen', 'play-again', 'end-home', 'result', 'result-detail']);
    expect(await smallTargets(page)).toEqual([]);
    expect(await toastsOverCells(page)).toEqual([]);
    await expect(page.getByTestId('toasts')).toBeHidden();
    const [frame, card, plate] = await Promise.all(['board-frame', 'end-screen', 'seat-A'].map(async (id) => (await page.getByTestId(id).boundingBox())!));
    expect(card!.y).toBeGreaterThanOrEqual(plate!.y + plate!.height);
    expect(card!.y).toBeGreaterThanOrEqual(frame!.y + frame!.height);
    await expectNameplates(page);
    expect((await emptyStrips(page)).bottom).toBeLessThanOrEqual(48);

    // On a shorter phone the ended board stops at 44 px tiles; once the shrink is over the column may
    // scroll, so Play again and Home stay reachable.
    await expect(page.getByTestId('match-screen')).not.toHaveAttribute('data-end-shrinking', /.*/);
    await page.setViewportSize({ width: 375, height: 667 });
    expect(await smallTargets(page)).toEqual([]);
    for (const id of ['play-again', 'end-home']) {
      await page.getByTestId(id).scrollIntoViewIfNeeded();
      await expect(page.getByTestId(id)).toBeInViewport({ ratio: 1 });
    }
  });
});

/** The phone's rows: the scoreboard row on top with the menu at its end, Player 2's nameplate, the board, Player 1's nameplate, the plates at most 96 px. */
async function expectNameplates(page: Page) {
  const box = async (testId: string) => (await page.getByTestId(testId).boundingBox())!;
  const [row, card, menu, frame, top, bottom] = await Promise.all(['scoreboard', 'match-card', 'menu-button', 'board-frame', 'seat-B', 'seat-A'].map(box));
  for (const plate of [top!, bottom!]) expect(plate.height).toBeLessThanOrEqual(96);
  expect(menu!.x).toBeGreaterThanOrEqual(row!.x + row!.width);
  expect(Math.abs(card!.y + card!.height / 2 - (menu!.y + menu!.height / 2))).toBeLessThan(8);
  expect(row!.y + row!.height).toBeLessThanOrEqual(top!.y);
  expect(menu!.y + menu!.height).toBeLessThanOrEqual(top!.y);
  expect(top!.y + top!.height).toBeLessThanOrEqual(frame!.y);
  expect(bottom!.y).toBeGreaterThanOrEqual(frame!.y + frame!.height);
  // The nameplates' text reads the same way up.
  for (const testId of ['seat-A', 'seat-B']) expect(await page.getByTestId(testId).evaluate((element) => getComputedStyle(element).transform)).toBe('none');
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

test('[scenario:keyboard-play] with the keyboard only, the player switches the opponent and the difficulty, starts a game in each mode from the home screen, changes the colour theme in the menu, sees a focused tile’s name, opens and closes the menu and How to Play, and takes legal tiles', async ({ page }, testInfo) => {
  await openHome(page);

  // How to Play from the home screen opens with Enter and closes with Escape.
  await tabTo(page, '[data-testid="open-how-to-play"]');
  await page.keyboard.press('Enter');
  await expect(page.getByRole('dialog', { name: 'How to play' })).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(page.getByTestId('open-how-to-play')).toBeFocused();

  // The Opponent switch is one Tab stop on the chosen key; the arrow keys move and select. A friend takes
  // the difficulty switch off the page, and back to the bot brings it back.
  await tabTo(page, '[data-testid="opponent-switch"] [role="radio"]', true);
  await expect(opponentSwitch(page).getByRole('radio', { name: 'Bot' })).toBeFocused();
  await page.keyboard.press('ArrowRight');
  await expect(opponentSwitch(page).getByRole('radio', { name: 'Friend' })).toBeFocused();
  await expect(opponentSwitch(page).getByRole('radio', { name: 'Friend' })).toHaveAttribute('aria-checked', 'true');
  await expect(difficultySwitch(page)).toHaveCount(0);
  await expect(playButton(page)).toHaveText('Play · with a friend');
  await page.keyboard.press('ArrowLeft');
  await expect(opponentSwitch(page).getByRole('radio', { name: 'Bot' })).toHaveAttribute('aria-checked', 'true');
  await expect(difficultySwitch(page)).toBeVisible();
  await expect(opponentSwitch(page).locator('[role="radio"][tabindex="0"]')).toHaveCount(1);

  // The difficulty switch, the next Tab stop: the arrow keys move and select, wrapping round.
  await page.keyboard.press('Tab');
  await expect(difficultySwitch(page).getByRole('radio', { name: 'Normal' })).toBeFocused();
  await page.keyboard.press('ArrowRight');
  await expect(difficultySwitch(page).getByRole('radio', { name: 'Hard' })).toBeFocused();
  await expect(difficultySwitch(page).getByRole('radio', { name: 'Hard' })).toHaveAttribute('aria-checked', 'true');
  await page.keyboard.press('ArrowRight');
  await expect(difficultySwitch(page).getByRole('radio', { name: 'Easy' })).toHaveAttribute('aria-checked', 'true');
  await expect(difficultySwitch(page).getByRole('radio', { name: 'Easy' })).toBeFocused();
  await expect(difficultySwitch(page).locator('[role="radio"][tabindex="0"]')).toHaveCount(1);

  // Start a bot game at Easy: Tab to Play, then Enter.
  await page.keyboard.press('Tab');
  await expect(playButton(page)).toBeFocused();
  await expect(playButton(page)).toHaveText('Play · Easy bot');
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

  // The colour theme in the menu: one Tab stop on the chosen theme, the arrow keys choose, at once.
  await page.keyboard.press('Enter');
  const themes = page.getByRole('dialog', { name: 'Menu' }).getByRole('radiogroup', { name: 'Theme' });
  await tabTo(page, '[data-testid="setting-palette"] [role="radio"]');
  await expect(themes.getByRole('radio', { name: 'Walnut' })).toBeFocused();
  await page.keyboard.press('ArrowRight');
  await expect(themes.getByRole('radio', { name: 'Sea glass' })).toBeFocused();
  await expect(themes.getByRole('radio', { name: 'Sea glass' })).toHaveAttribute('aria-checked', 'true');
  await expect(page.locator('html')).toHaveAttribute('data-palette', 'seaglass');
  await page.keyboard.press('ArrowLeft');
  await expect(page.locator('html')).toHaveAttribute('data-palette', 'walnut');
  await expect(themes.locator('[role="radio"][tabindex="0"]')).toHaveCount(1);
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

  // The focused tile shows its name on its plate, and only it.
  await arrowTo(page, 'B2');
  const named = await page.locator('[data-testid="board"] [data-cell]').evaluateAll((cells) =>
    cells.filter((cell) => cell.querySelector('.tile-name') && getComputedStyle(cell.querySelector('.tile-name')!).display !== 'none').map((cell) => [cell.getAttribute('data-cell'), cell.querySelector('.tile-name')!.textContent]),
  );
  const b2 = (await readBoard(page)).find((cell) => cell.cell === 'B2')!;
  expect(named).toEqual([['B2', `${b2.terrain}–${b2.symbol}`]]);
  // Keyboard focus keeps its own visible ring, which no glow or fade replaces.
  const ring = await page.evaluate(() => {
    const style = getComputedStyle(document.activeElement!);
    return { style: style.outlineStyle, width: parseFloat(style.outlineWidth) };
  });
  expect(ring.style).toBe('solid');
  expect(ring.width).toBeGreaterThanOrEqual(2);

  // Enter on an inner tile is refused; Enter on a glowing edge tile takes it.
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

  // Back home through the menu, a friend chosen with the keyboard, then a two-player game, where the
  // keyboard takes for both seats.
  await tabTo(page, '[data-testid="menu-button"]', true);
  await page.keyboard.press('Enter');
  await tabTo(page, '[data-testid="menu-quit"]');
  await page.keyboard.press('Enter');
  await tabTo(page, '[data-testid="opponent-switch"] [role="radio"]');
  await page.keyboard.press('ArrowRight');
  await expect(opponentSwitch(page).getByRole('radio', { name: 'Friend' })).toHaveAttribute('aria-checked', 'true');
  await tabTo(page, '[data-testid="play"]');
  await expect(playButton(page)).toHaveText('Play · with a friend');
  await page.keyboard.press('Enter');
  await expect(board(page)).toBeVisible();
  await expect(page.getByTestId('match-screen')).toHaveAttribute('data-mode', 'two-player');
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
