/// <reference lib="dom" />
// The DOM library types the callbacks that run in the page (page.evaluate).
import { expect, test, type Page } from '@playwright/test';
import { tilesMatch, type Tile } from '@okiya/game';
import {
  attachScreenshot,
  board,
  cellAt,
  continueSaved,
  glowing,
  highlightPixels,
  HUMAN_STARTS,
  legalFromPage,
  match,
  nearEnding,
  openHome,
  PALETTES,
  readBoard,
  readScore,
  refusalToast,
  seat,
  seededPosition,
  setPalette,
  startGame,
  startTwoPlayerGame,
  takeGlowing,
  waitForHumanTurn,
} from './helpers';

// The final polish (PRD R2, U2, U5, E3, P3): the move highlights measured from rendered pixels in every
// colour theme, the theme switch with no flash, and the scoreboard row. Randomness is fixed per test;
// themes are checked by switching data-palette and the colour scheme on one seeded position, never by
// replaying games, and motion is on only where a check says so.

const VIEWPORTS = [
  { name: 'wide', viewport: { width: 1280, height: 720 } },
  { name: '390 × 844', viewport: { width: 390, height: 844 } },
] as const;

/** One pop as the page ran it: the cell, its order, the animation, its delay and duration, and whose turn it was. */
interface PopRecord {
  readonly cell: string;
  readonly order: number;
  readonly name: string;
  readonly delay: number;
  readonly duration: number;
  readonly toMove: string | null;
  readonly takes: string | null;
  readonly transitions: number;
}

/** Starts recording every pop the page starts, with its timing and whose turn it is, from now on. */
async function recordPops(page: Page) {
  await page.evaluate(() => {
    const w = window as unknown as { __pops: PopRecord[]; __popListener?: (event: AnimationEvent) => void };
    if (w.__popListener) document.removeEventListener('animationstart', w.__popListener, true);
    w.__pops = [];
    w.__popListener = (event: AnimationEvent) => {
      if (!/^pop-(odd|even)$/.test(event.animationName)) return;
      const cell = event.target as Element;
      const animation = cell.getAnimations().find((candidate) => (candidate as CSSAnimation).animationName === event.animationName);
      const timing = animation?.effect?.getTiming();
      const screen = document.querySelector('[data-testid="match-screen"]');
      w.__pops.push({
        cell: cell.getAttribute('data-cell')!,
        order: Number(cell.getAttribute('data-pop-order')),
        name: event.animationName,
        delay: Number(timing?.delay ?? -1),
        duration: Number(timing?.duration ?? -1),
        toMove: screen?.getAttribute('data-to-move') ?? null,
        takes: screen?.getAttribute('data-takes') ?? null,
        // No CSS transition competes with the pop on any glowing cell when the turn starts.
        transitions: [...document.querySelectorAll('[data-testid="board"] [data-glow="true"]')].flatMap((glow) => glow.getAnimations().filter((candidate) => candidate instanceof CSSTransition)).length,
      });
    };
    document.addEventListener('animationstart', w.__popListener, true);
  });
}

async function recordedPops(page: Page): Promise<PopRecord[]> {
  return page.evaluate(() => (window as unknown as { __pops: PopRecord[] }).__pops);
}

/** Every glowing cell with its data-pop-order. */
async function popOrders(page: Page): Promise<{ cell: string; order: number }[]> {
  return glowing(page).evaluateAll((cells) => cells.map((cell) => ({ cell: cell.getAttribute('data-cell')!, order: Number(cell.getAttribute('data-pop-order')) })));
}

/** The pops of one turn: one per glowing cell, in data-pop-order, delays rising, the whole within 400 ms. */
function expectOnePopPerTile(pops: PopRecord[], orders: { cell: string; order: number }[]) {
  expect(pops.map((pop) => pop.cell).sort()).toEqual(orders.map((entry) => entry.cell).sort());
  const byOrder = [...pops].sort((a, b) => a.order - b.order);
  expect(byOrder.map((pop) => pop.order)).toEqual(orders.map((entry) => entry.order).sort((a, b) => a - b));
  expect(byOrder.map((pop) => pop.order)).toEqual(byOrder.map((_pop, index) => index));
  // The delays differ by order, rising with it, and the last pop ends within 400 ms of the turn's start.
  const delays = byOrder.map((pop) => pop.delay);
  expect(delays.every((delay, index) => index === 0 || delay > delays[index - 1]!), JSON.stringify(delays)).toBe(true);
  expect(Math.max(...byOrder.map((pop) => pop.delay + pop.duration))).toBeLessThan(400);
  expect(new Set(byOrder.map((pop) => pop.name)).size).toBe(1);
  for (const pop of byOrder) expect(pop.transitions, pop.cell).toBe(0);
}

test('[scenario:move-highlight] in every colour theme, light and dark, wide and at 390 × 844, the rendered ring reaches 3:1 against the bare well and playable tiles stand 12 L* apart from faded ones; with motion on the playable tiles pop once in order within 400 ms when a person’s turn starts, never on the bot’s turn, and again for every legal tile on the next turn of a two-player game', async ({ browser }, testInfo) => {
  test.setTimeout(240_000);
  // One seeded two-player position with Player 1 to move, where faded and taken tiles sit beside the rings.
  const position = seededPosition(4);
  expect(position.toMove).toBe('A');
  const context = await browser.newContext({ baseURL: testInfo.project.use.baseURL!, reducedMotion: 'reduce', deviceScaleFactor: 2, viewport: VIEWPORTS[0].viewport });
  const page = await context.newPage();
  await openHome(page);
  await continueSaved(page, position, 'two-player');
  const cells = await readBoard(page);
  expect(cells.some((cell) => cell.glow)).toBe(true);
  await expect(board(page).locator('[data-faded="true"]')).not.toHaveCount(0);
  await expect(board(page).locator('[data-taken="true"]')).toHaveCount(4);

  const report: string[] = [];
  for (const { name, viewport } of VIEWPORTS) {
    await page.setViewportSize(viewport);
    await expect(board(page)).toBeVisible();
    // The neon themes glow over the gaps, so no bare well shows beside a ring; their rings are checked
    // against the well by the unit tests of the tokens (RING_PAIRS), in the one dark set they have.
    for (const palette of PALETTES.filter((id) => !['night-circuit', 'neon-frost', 'synth-horizon', 'midnight-aurora'].includes(id))) {
      for (const colorScheme of ['light', 'dark'] as const) {
        await page.emulateMedia({ colorScheme });
        await setPalette(page, palette);
        const where = `${palette} ${colorScheme} ${name}`;
        const pixels = await highlightPixels(page);
        expect(pixels.dpr, where).toBeCloseTo(2, 1);
        expect(pixels.rings.length, where).toBe(cells.filter((cell) => cell.glow).length);
        for (const ring of pixels.rings) {
          // Fails loudly when no bare well was found beside a ring, rather than measuring a halo or a shadow.
          expect(ring.wellPixels, `${where} ${ring.cell}: bare well beside the ring`).toBeGreaterThan(0);
          expect(ring.ratio, `${where} ${ring.cell}: ring against the well`).toBeGreaterThanOrEqual(3);
        }
        expect(pixels.lightness.length, `${where}: a terrain with playable and faded tiles`).toBeGreaterThan(0);
        for (const { terrain, playable, faded } of pixels.lightness) expect(Math.abs(playable - faded), `${where} ${terrain}: ${playable.toFixed(1)} against ${faded.toFixed(1)} L*`).toBeGreaterThanOrEqual(12);
        report.push(`${where}: rings ≥ ${Math.min(...pixels.rings.map((ring) => ring.ratio)).toFixed(2)}:1, L* apart ≥ ${Math.min(...pixels.lightness.map(({ playable, faded }) => Math.abs(playable - faded))).toFixed(1)}`);
      }
    }
  }
  await testInfo.attach('highlight measurements', { body: report.join('\n'), contentType: 'text/plain' });
  await page.emulateMedia({ colorScheme: 'light' });
  await setPalette(page, 'walnut');
  await page.setViewportSize(VIEWPORTS[0].viewport);
  await attachScreenshot(page, testInfo, 'move-highlight');
  await context.close();

  // With motion on, in a bot game: the pop plays when your turn starts, once, never on the bot's turn.
  const motion = await browser.newContext({ baseURL: testInfo.project.use.baseURL!, reducedMotion: 'no-preference' });
  const live = await motion.newPage();
  await startGame(live, { seed: HUMAN_STARTS, difficulty: 'Easy' });
  // The opening's own pop finishes first, so every pop recorded below belongs to a later turn.
  await live.waitForTimeout(450);
  await recordPops(live);
  await takeGlowing(live);
  await waitForHumanTurn(live);
  await expect(glowing(live).first()).toBeVisible();
  await expect.poll(async () => (await recordedPops(live)).length, { timeout: 2_000 }).toBe(await glowing(live).count());
  await live.waitForTimeout(500);
  const turn = await recordedPops(live);
  // Nothing popped while the bot chose: every pop came on your turn, after the bot's take.
  expect(turn.map((pop) => [pop.toMove, pop.takes]), 'nothing pops on the bot’s turn').toEqual(turn.map(() => ['A', '2']));
  expectOnePopPerTile(turn, await popOrders(live));
  // A re-render (a refused tap, its toast and the wince) never replays the pop.
  const { illegal } = await legalFromPage(live);
  await cellAt(live, illegal[0]!.cell).click();
  await expect(refusalToast(live)).toBeVisible();
  await live.waitForTimeout(450);
  expect(await recordedPops(live)).toHaveLength(turn.length);
  // The glowing cells rest raised, the pop over.
  expect(await glowing(live).evaluateAll((elements) => elements.map((element) => getComputedStyle(element).translate))).toEqual(Array(turn.length).fill('0px -3px'));

  // In a two-player game the pop replays on the next turn for every legal tile, one legal on both turns too.
  await startTwoPlayerGame(live, { seed: HUMAN_STARTS });
  const opening = await readBoard(live);
  const glows = opening.filter((cell) => cell.glow);
  const tile = (cell: { terrain: string; symbol: string }) => ({ terrain: cell.terrain, symbol: cell.symbol }) as Tile;
  const choice = glows.find((candidate) => glows.some((other) => other.cell !== candidate.cell && tilesMatch(tile(other), tile(candidate))))!;
  expect(choice, 'an opening take that leaves another glowing tile legal').toBeDefined();
  const stays = glows.find((other) => other.cell !== choice.cell && tilesMatch(tile(other), tile(choice)))!;
  await live.waitForTimeout(450);
  await recordPops(live);
  // The starter alternates from the game before, so either seat may open.
  const opener = await match(live).getAttribute('data-to-move');
  await cellAt(live, choice.cell).click();
  await expect(match(live)).toHaveAttribute('data-to-move', opener === 'A' ? 'B' : 'A');
  await expect(cellAt(live, stays.cell)).toHaveAttribute('data-glow', 'true');
  await expect.poll(async () => (await recordedPops(live)).length, { timeout: 2_000 }).toBe(await glowing(live).count());
  await live.waitForTimeout(450);
  const next = await recordedPops(live);
  expectOnePopPerTile(next, await popOrders(live));
  expect(next.map((pop) => pop.cell)).toContain(stays.cell);
  expect(next.every((pop) => pop.name === 'pop-odd')).toBe(true);
  await motion.close();
});

/** Records every value the root's data-palette takes in this page load, and whether the app's script had run by then. */
async function watchPalette(page: Page) {
  await page.addInitScript(() => {
    const w = window as unknown as { __palettes: { value: string | null; appRan: boolean }[] };
    w.__palettes = [];
    new MutationObserver((records) => {
      for (const record of records) {
        if (record.attributeName !== 'data-palette' || record.target !== document.documentElement) continue;
        // The app's script prepends the theme's token style sheet first thing; before it runs, there is none.
        w.__palettes.push({ value: document.documentElement.getAttribute('data-palette'), appRan: document.querySelector('style[data-theme="tokens"]') !== null });
      }
    }).observe(document, { attributes: true, attributeFilter: ['data-palette'], subtree: true });
  });
}

async function paletteHistory(page: Page) {
  return page.evaluate(() => (window as unknown as { __palettes: { value: string | null; appRan: boolean }[] }).__palettes);
}

/** The colours a theme changes, read from the page. */
async function pageColours(page: Page) {
  return page.evaluate(() => {
    const colour = (selector: string, property: 'backgroundColor' | 'color' = 'backgroundColor') => {
      const element = document.querySelector(selector);
      return element ? getComputedStyle(element)[property] : null;
    };
    return { ground: colour('body'), well: colour('[data-testid="board"]'), primary: colour('button.primary'), text: colour('body', 'color') };
  });
}

test('[scenario:colour-themes] the menu and Settings offer Walnut (the default), Sea glass and Clear; a choice changes the root’s data-palette and the colours, survives a reload set before the app script runs with no flash of another theme, and a first visit shows no picker', async ({ page }, testInfo) => {
  test.setTimeout(90_000);
  await watchPalette(page);
  await openHome(page);
  const root = page.locator('html');

  // A first visit: the default theme, set by the page before any app script ran, and no picker.
  await expect(root).toHaveAttribute('data-palette', 'walnut');
  const first = await paletteHistory(page);
  expect(first[0]).toEqual({ value: 'walnut', appRan: false });
  expect(first.every((entry) => entry.value === 'walnut')).toBe(true);
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(page.getByRole('radiogroup', { name: 'Theme' })).toHaveCount(0);
  const walnut = await pageColours(page);

  // Settings on the home screen: three themes, Walnut chosen; Sea glass changes the root and the colours at once.
  await page.getByTestId('open-settings').click();
  const settings = page.getByRole('dialog', { name: 'Settings' });
  const themes = settings.getByRole('radiogroup', { name: 'Theme' });
  expect(await themes.getByRole('radio').allTextContents()).toEqual(['Night Circuit', 'Neon Frost', 'Synth Horizon', 'Midnight Aurora', 'Walnut', 'Sea glass', 'Clear']);
  await expect(themes.getByRole('radio', { name: 'Walnut' })).toHaveAttribute('aria-checked', 'true');
  await themes.getByRole('radio', { name: 'Sea glass' }).click();
  await expect(themes.getByRole('radio', { name: 'Sea glass' })).toHaveAttribute('aria-checked', 'true');
  await expect(root).toHaveAttribute('data-palette', 'seaglass');
  const seaglass = await pageColours(page);
  expect(seaglass.ground).not.toBe(walnut.ground);
  expect(seaglass.primary).not.toBe(walnut.primary);
  await page.keyboard.press('Escape');

  // A reload keeps it, set before the app's script runs, and no other theme ever shows first.
  await page.reload();
  await expect(page.getByTestId('home-screen')).toBeVisible();
  await expect(root).toHaveAttribute('data-palette', 'seaglass');
  const reloaded = await paletteHistory(page);
  expect(reloaded[0]).toEqual({ value: 'seaglass', appRan: false });
  expect(reloaded.map((entry) => entry.value)).toEqual(reloaded.map(() => 'seaglass'));
  expect((await pageColours(page)).ground).toBe(seaglass.ground);

  // The game menu: Clear, then back to Walnut; the board's well follows.
  await page.getByTestId('opponent-switch').getByRole('radio', { name: 'Friend' }).click();
  await page.getByTestId('play').click();
  await expect(board(page)).toBeVisible();
  const seaglassWell = (await pageColours(page)).well;
  await page.getByTestId('menu-button').click();
  const menuThemes = page.getByRole('dialog', { name: 'Menu' }).getByRole('radiogroup', { name: 'Theme' });
  await expect(menuThemes.getByRole('radio', { name: 'Sea glass' })).toHaveAttribute('aria-checked', 'true');
  await menuThemes.getByRole('radio', { name: 'Clear' }).click();
  await expect(root).toHaveAttribute('data-palette', 'clear');
  const clear = await pageColours(page);
  expect(clear.well).not.toBe(seaglassWell);
  expect(clear.ground).not.toBe(seaglass.ground);
  await page.getByRole('button', { name: 'Resume' }).click();
  await attachScreenshot(page, testInfo, 'colour-themes');
  await page.reload();
  await expect(root).toHaveAttribute('data-palette', 'clear');
  expect((await paletteHistory(page))[0]).toEqual({ value: 'clear', appRan: false });
  await page.getByTestId('continue').click();
  await page.getByTestId('menu-button').click();
  await page.getByRole('dialog', { name: 'Menu' }).getByRole('radiogroup', { name: 'Theme' }).getByRole('radio', { name: 'Walnut' }).click();
  await expect(root).toHaveAttribute('data-palette', 'walnut');
  expect((await pageColours(page)).ground).toBe(walnut.ground);
  // No picker ever opened by itself: the only dialog was the one the menu button opened.
  await expect(page.getByRole('dialog')).toHaveCount(1);
});

/**
 * The scoreboard row's layout and colours, at the current viewport: the row holds the Match card above the
 * board, and each seat shows its own wins in its player's colour on its nameplate.
 */
async function expectScoreboard(page: Page, layout: 'wide' | 'phone', name: string) {
  const box = async (id: string) => (await page.getByTestId(id).boundingBox())!;
  const [row, one, card, two, frame, seatA, seatB, menu] = await Promise.all(['scoreboard', 'score-A', 'match-card', 'score-B', 'board-frame', 'seat-A', 'seat-B', 'menu-button'].map(box));
  expect(row!.y + row!.height).toBeLessThanOrEqual(frame!.y);
  // Each seat's wins sit inside its own nameplate, at its right end.
  for (const [wins, seatBox] of [[one!, seatA!], [two!, seatB!]] as const) {
    expect(wins.x).toBeGreaterThanOrEqual(seatBox.x);
    expect(wins.x + wins.width).toBeLessThanOrEqual(seatBox.x + seatBox.width);
    expect(wins.y).toBeGreaterThanOrEqual(seatBox.y);
    expect(wins.y + wins.height).toBeLessThanOrEqual(seatBox.y + seatBox.height);
  }
  // Each score underlined in its player's colour, the token's own fill, with its token mark on the seat; the two apart.
  const looks = await page.evaluate(() =>
    ['A', 'B'].map((player) => {
      const wins = document.querySelector(`[data-testid="score-${player}"]`)!;
      const seat = document.querySelector(`[data-testid="seat-${player}"]`)!;
      return { colour: getComputedStyle(wins).borderBottomColor, token: getComputedStyle(seat.querySelector('.count-token')!).backgroundColor, mark: seat.querySelector('svg.token-mark')!.getAttribute('data-shape'), wins: wins.textContent };
    }),
  );
  expect(looks.map((look) => look.mark)).toEqual(['ring', 'diamond']);
  for (const look of looks) expect(look.colour).toBe(look.token);
  expect(looks[0]!.colour).not.toBe(looks[1]!.colour);
  // The group's accessible name reads the score; the draws line is hidden at zero; no floating score line is left.
  await expect(page.getByRole('group', { name, exact: true })).toBeVisible();
  await expect(page.getByTestId('sitting-score')).toHaveCount(0);
  if (layout === 'wide') {
    // A strip at the top centre, over the board and not under a nameplate.
    expect(row!.height).toBeLessThanOrEqual(92);
    expect(Math.abs(card!.x + card!.width / 2 - (frame!.x + frame!.width / 2))).toBeLessThan(4);
    expect(card!.y + card!.height).toBeLessThanOrEqual(seatA!.y);
    // At 1280 × 720 the height budget leaves the board frame at least 460 px tall, with no page scrolling.
    const { width, height } = page.viewportSize()!;
    if (width >= 1280 && height <= 720) {
      expect(frame!.height).toBeGreaterThanOrEqual(460);
      expect(await page.evaluate(() => document.documentElement.scrollHeight - window.innerHeight)).toBeLessThanOrEqual(0);
    }
  } else {
    // The top row, with the menu button at its end, then Player 2's nameplate.
    expect(row!.y).toBeLessThan(seatB!.y);
    expect(row!.y + row!.height).toBeLessThanOrEqual(seatB!.y);
    expect(menu!.x).toBeGreaterThanOrEqual(row!.x + row!.width);
    expect(menu!.y + menu!.height / 2).toBeGreaterThan(card!.y);
    expect(menu!.y + menu!.height / 2).toBeLessThan(card!.y + card!.height);
  }
}

/** Every element of the table that spills out of the viewport, and the page's horizontal overflow. */
async function spills(page: Page, ids: readonly string[]) {
  const { width, height } = page.viewportSize()!;
  const out: string[] = [];
  for (const id of ids) {
    const box = (await page.getByTestId(id).boundingBox())!;
    if (box.x < 0 || box.y < 0 || box.x + box.width > width || box.y + box.height > height) out.push(`${id} ${JSON.stringify(box)}`);
  }
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  return { out, overflow };
}

test('[scenario:scoreboard] the scoreboard row sits above the board holding the Match card, each seat’s wins sit on its own nameplate in its colour with its mark, the draws under the card hidden at zero, its name reading the score; at the top centre on a wide screen, the top row with the menu on a phone, nothing spilling at 761 px, and a draw shifting nothing', async ({ page }, testInfo) => {
  test.setTimeout(120_000);
  await startGame(page);
  await takeGlowing(page);
  await waitForHumanTurn(page);
  await expect(page.getByTestId('score-draws')).toBeHidden();
  await expectScoreboard(page, 'wide', 'You 0, Bot 0');
  await attachScreenshot(page, testInfo, 'scoreboard');

  // At the narrowest wide layout the row spans the columns and nothing spills or overflows.
  await page.setViewportSize({ width: 761, height: 720 });
  await expectScoreboard(page, 'wide', 'You 0, Bot 0');
  expect(await spills(page, ['scoreboard', 'score-A', 'match-card', 'score-B', 'menu-button', 'seat-A', 'seat-B', 'board-frame'])).toEqual({ out: [], overflow: 0 });

  // At 390 × 844, the top row with the menu at its end.
  await page.setViewportSize({ width: 390, height: 844 });
  await expectScoreboard(page, 'phone', 'You 0, Bot 0');
  await expect(page.getByTestId('score-draws')).toBeHidden();

  // A draw in a two-player sitting: "1 draw" under the Match card, and the row, the card, the seats and
  // the board stay where they were on a wide screen; on a phone the row and Player 2's nameplate stay put.
  for (const viewport of [
    { width: 1280, height: 720 },
    { width: 390, height: 844 },
  ]) {
    await page.setViewportSize(viewport);
    const { state, ends } = nearEnding('draw');
    await continueSaved(page, state, 'two-player');
    const boxes = async (ids: readonly string[]) => Promise.all(ids.map(async (id) => (await page.getByTestId(id).boundingBox())!));
    const steady = viewport.width > 760 ? ['scoreboard', 'match-card', 'board-frame', 'seat-A', 'seat-B', 'score-draws'] : ['scoreboard', 'match-card', 'seat-B', 'score-draws'];
    const before = await boxes(steady);
    await cellAt(page, ends[0]!).click();
    await expect(page.getByTestId('end-screen')).toHaveAttribute('data-winner', 'draw');
    await expect(page.getByTestId('score-draws')).toBeVisible();
    await expect(page.getByTestId('score-draws')).toHaveText('1 draw');
    expect(await readScore(page)).toEqual({ a: 0, b: 0, draws: 1, text: 'Player 1 0, Player 2 0, 1 draw' });
    const [draws, card] = await boxes(['score-draws', 'match-card']);
    expect(draws!.y).toBeGreaterThanOrEqual(card!.y + card!.height);
    expect(Math.abs(draws!.x + draws!.width / 2 - (card!.x + card!.width / 2))).toBeLessThan(2);
    const after = await boxes(steady);
    for (const [index, id] of steady.entries()) {
      if (id === 'score-draws') {
        expect(after[index]!.y, id).toBeCloseTo(before[index]!.y, 0);
        expect(after[index]!.height, id).toBeCloseTo(before[index]!.height, 0);
      } else expect(after[index], id).toEqual(before[index]);
    }
    await expectScoreboard(page, viewport.width > 760 ? 'wide' : 'phone', 'Player 1 0, Player 2 0, 1 draw');
    await expect(seat(page, 'A')).toHaveAttribute('data-score', '0');
  }
});
