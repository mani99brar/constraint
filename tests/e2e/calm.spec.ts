/// <reference lib="dom" />
// The DOM library types the callbacks that run in the page (page.evaluate).
import { expect, test, type Page } from '@playwright/test';
import { cellColumn, cellRow, take, type CellId, type GameState } from '@okiya/game';
import {
  attachScreenshot,
  board,
  cellAt,
  gameLogOfState,
  glowing,
  legalFromPage,
  match,
  nearEnding,
  openHome,
  readBoard,
  seat,
  startGame,
  startTwoPlayerGame,
  takeCount,
  takeGlowing,
  toMove,
  waitForHumanTurn,
  type Ending,
} from './helpers';

// The calm table (PRD R2, I1, I2, E3, U10): the legal-tile look, tile names on demand and the end
// sequence. Randomness is fixed per test; only the end sequence turns motion on, and it reaches its
// endings through seeded saves and Continue, confirms running animations with getAnimations() and reads
// taps through listeners installed in the page before the action.

type Rgba = { r: number; g: number; b: number; a: number };

/** The look of every cell as the page paints it: lift, ring, halo, tint, badge, veil, outline and opacity. */
async function cellLooks(page: Page) {
  return board(page)
    .locator('[data-cell]')
    .evaluateAll((elements) => {
      const parse = (value: string): Rgba => {
        const parts = value.match(/-?[\d.]+(?:e-?\d+)?/g)?.map(Number) ?? [0, 0, 0, 0];
        const scale = value.startsWith('color(') ? 255 : 1;
        return { r: parts[0]! * scale, g: parts[1]! * scale, b: parts[2]! * scale, a: parts.length > 3 ? parts[3]! : 1 };
      };
      /** The colours in a computed box-shadow, in order. */
      const shadowColours = (value: string) => [...value.matchAll(/(?:rgba?|color)\([^)]*\)/g)].map((match) => parse(match[0]));
      return elements.map((element) => {
        const style = getComputedStyle(element);
        const face = element.querySelector('.tile-face')!;
        const badge = element.querySelector('[data-testid="move-badge"]');
        const edge = getComputedStyle(face, '::before').boxShadow;
        return {
          cell: element.getAttribute('data-cell')!,
          owner: element.getAttribute('data-owner'),
          glow: element.getAttribute('data-glow') === 'true',
          faded: element.getAttribute('data-faded') === 'true',
          taken: element.getAttribute('data-taken') === 'true',
          last: element.getAttribute('data-last') === 'true',
          translate: style.translate,
          opacity: Number(style.opacity),
          faceOpacity: Number(getComputedStyle(face).opacity),
          outline: style.outlineStyle,
          ring: parse(style.borderTopColor),
          // The ring: the cell's border and the tint layer's inset edge ("<colour> 0px 0px 0px 2px inset").
          ringWidth: parseFloat(style.borderTopWidth) + (edge === 'none' ? 0 : Number(/0px 0px 0px ([\d.]+)px inset/.exec(edge)?.[1] ?? 0)),
          shadows: shadowColours(style.boxShadow),
          tint: parse(getComputedStyle(face, '::before').backgroundColor),
          tintEdge: shadowColours(edge),
          badge: badge ? { colour: parse(getComputedStyle(badge).backgroundColor), mark: badge.getAttribute('data-mark') } : null,
          veil: parse(getComputedStyle(face, '::after').backgroundColor),
        };
      });
    });
}

/** Each player's colour, as their token's solid fill on the scoreboard. */
async function playerColours(page: Page): Promise<Record<'A' | 'B', Rgba>> {
  return page.evaluate(() => {
    const parse = (value: string) => {
      const parts = value.match(/[\d.]+/g)!.map(Number);
      const scale = value.startsWith('color(') ? 255 : 1;
      return { r: parts[0]! * scale, g: parts[1]! * scale, b: parts[2]! * scale, a: 1 };
    };
    const probe = (player: string) => parse(getComputedStyle(document.querySelector(`[data-testid="seat-${player}-tokens"] .count-token`)!).backgroundColor);
    return { A: probe('A'), B: probe('B') };
  });
}

const sameColour = (a: Rgba, b: Rgba) => Math.abs(a.r - b.r) < 2 && Math.abs(a.g - b.g) < 2 && Math.abs(a.b - b.b) < 2;

/**
 * With highlights on and a person to move: the legal tiles stay raised with a halo, a 3 px ring, a tint
 * of about 30% and a corner badge, all in the mover's colour and mark; the other free tiles fade under a
 * veil while the cell stays opaque; taken cells never fade; the last take carries a soft ring in its
 * taker's colour.
 */
async function expectLegalLook(page: Page, mover: 'A' | 'B') {
  const { legal } = await legalFromPage(page);
  const looks = await cellLooks(page);
  const colours = await playerColours(page);
  const colour = colours[mover];
  expect(looks.filter((look) => look.glow).map((look) => look.cell)).toEqual(legal);
  for (const look of looks) {
    expect(look.opacity, look.cell).toBe(1);
    expect(look.faceOpacity, look.cell).toBe(1);
    expect(look.outline, look.cell).toBe('none');
    if (look.glow) {
      expect(look.translate, look.cell).toMatch(/^0px -[1-9]\d*(\.\d+)?px$/);
      expect(sameColour(look.ring, colour), `${look.cell} is ringed in the mover's colour`).toBe(true);
      expect(look.ringWidth, look.cell).toBeGreaterThanOrEqual(2);
      expect(look.ringWidth, look.cell).toBeLessThanOrEqual(3);
      expect(look.tintEdge.some((edge) => sameColour(edge, colour) && edge.a === 1), `${look.cell} ring's inner edge`).toBe(true);
      expect(sameColour(look.shadows[0]!, colour), `${look.cell} has a halo of the mover's colour`).toBe(true);
      expect(sameColour(look.tint, colour), `${look.cell} is tinted in the mover's colour`).toBe(true);
      // A light wash (8 to 14%) so the tile's art still reads under it.
      expect(look.tint.a, look.cell).toBeGreaterThanOrEqual(0.07);
      expect(look.tint.a, look.cell).toBeLessThanOrEqual(0.2);
      expect(look.badge, look.cell).not.toBeNull();
      expect(sameColour(look.badge!.colour, colour), `${look.cell} badge`).toBe(true);
      expect(look.badge!.mark, look.cell).toBe(mover === 'A' ? 'ring' : 'diamond');
      expect(look.veil.a, look.cell).toBe(0);
    } else {
      expect(look.translate, look.cell).toMatch(/^(none|0px)$/);
      expect(look.tint.a, look.cell).toBe(0);
      expect(look.badge, look.cell).toBeNull();
      expect(sameColour(look.ring, colour), `${look.cell} has no ring in the mover's colour`).toBe(false);
    }
    if (look.taken) {
      expect(look.faded, look.cell).toBe(false);
      expect(look.veil.a, look.cell).toBe(0);
    } else if (!look.glow) {
      expect(look.faded, look.cell).toBe(true);
      // A veil of the ground fades the art back.
      expect(look.veil.a, look.cell).toBeGreaterThanOrEqual(0.3);
      expect(look.veil.a, look.cell).toBeLessThanOrEqual(0.65);
    }
  }
  // The last take: a soft ring in its taker's colour on its slot, the other taken cells without one.
  const last = looks.filter((look) => look.last);
  expect(last).toHaveLength(1);
  const taker = last[0]!.owner as 'A' | 'B';
  expect(last[0]!.shadows.some((shadow) => sameColour(shadow, colours[taker]) && shadow.a === 1), 'the last take is ringed in its taker’s colour').toBe(true);
  for (const other of looks.filter((look) => look.taken && !look.last)) expect(other.shadows.some((shadow) => sameColour(shadow, colours.A) || sameColour(shadow, colours.B)), other.cell).toBe(false);
  await expect(board(page).locator('.last-mark, .winning-mark')).toHaveCount(0);
  expect(await cellAt(page, last[0]!.cell).evaluate((element) => getComputedStyle(element).outlineStyle)).toBe('none');
}

/** Records, at every change of the turn or the board, how much of the move highlight shows and whose turn it is. */
async function recordHighlights(page: Page) {
  await page.evaluate(() => {
    const w = window as unknown as { __highlights: { toMove: string | null; accepts: string | null; lit: number }[]; __highlightObserver?: MutationObserver };
    w.__highlightObserver?.disconnect();
    w.__highlights = [];
    const screen = document.querySelector('[data-testid="match-screen"]')!;
    const snapshot = () =>
      w.__highlights.push({
        toMove: screen.getAttribute('data-to-move'),
        accepts: screen.getAttribute('data-accepts-takes'),
        lit: screen.querySelectorAll('[data-glow="true"], [data-faded="true"], [data-testid="move-badge"], [data-pop-order], [data-pop-turn], [data-glow-player]').length,
      });
    w.__highlightObserver = new MutationObserver(snapshot);
    w.__highlightObserver.observe(screen, { attributes: true, subtree: true, childList: true });
    snapshot();
  });
}

test('[scenario:legal-tiles] with highlights on and a person to move, the legal tiles stay raised with a halo, a ring, a tint and a corner badge in the mover’s colour and mark, the others fade, taken cells do not, and the last take carries a soft ring in its taker’s colour, wide and at 390 × 844; in a two-player game the colour and badge follow the mover, and on the bot’s turn nothing is highlighted', async ({ page }, testInfo) => {
  test.setTimeout(90_000);
  await startGame(page);
  await recordHighlights(page);
  await takeGlowing(page);
  await waitForHumanTurn(page);
  await expectLegalLook(page, 'A');
  await expect(board(page)).toHaveAttribute('data-glow-player', 'A');
  // While the bot chose, nothing popped, faded, glowed or carried a badge.
  const record = await page.evaluate(() => (window as unknown as { __highlights: { toMove: string | null; accepts: string | null; lit: number }[] }).__highlights);
  const botTurn = record.filter((entry) => entry.toMove === 'B');
  expect(botTurn.length).toBeGreaterThan(0);
  for (const entry of botTurn) expect(entry).toEqual({ toMove: 'B', accepts: 'false', lit: 0 });
  await attachScreenshot(page, testInfo, 'legal-tiles');

  // At 390 × 844 the same look.
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(seat(page, 'A')).toBeVisible();
  await expectLegalLook(page, 'A');

  // In a two-player game the colour and the badge follow the mover: Player 1's ring, then Player 2's diamond.
  await page.setViewportSize({ width: 1280, height: 720 });
  await page.getByTestId('menu-button').click();
  await page.getByRole('button', { name: /^Quit to title/ }).click();
  await page.getByTestId('opponent-switch').getByRole('radio', { name: 'Friend' }).click();
  await page.getByTestId('play').click();
  await expect(match(page)).toHaveAttribute('data-mode', 'two-player');
  await takeGlowing(page);
  const movers: string[] = [];
  for (let i = 0; i < 2; i += 1) {
    const mover = await toMove(page);
    movers.push(mover);
    await expect(board(page)).toHaveAttribute('data-glow-player', mover);
    await expectLegalLook(page, mover);
    await takeGlowing(page);
  }
  expect(new Set(movers)).toEqual(new Set(['A', 'B']));
});

/** Whether the name plate on a cell shows, its text, whether it is the topmost element at its own centre, and whether it is solid. */
async function plateOf(page: Page, cell: string) {
  return cellAt(page, cell).evaluate((element) => {
    const plate = element.querySelector('.tile-name');
    if (!plate) return null;
    const style = getComputedStyle(plate);
    const box = plate.getBoundingClientRect();
    const shown = style.display !== 'none' && box.width > 0;
    const hit = shown ? document.elementFromPoint(box.left + box.width / 2, box.top + box.height / 2) : null;
    const colour = style.backgroundColor.match(/[\d.]+/g)!.map(Number);
    return { shown, text: plate.textContent, onTop: hit !== null && plate.contains(hit), solid: colour.length < 4 || colour[3] === 1, zIndex: style.zIndex };
  });
}

/** Every free cell whose name plate shows. */
async function shownPlates(page: Page): Promise<string[]> {
  return board(page)
    .locator('[data-cell][data-taken="false"]')
    .evaluateAll((elements) => elements.filter((element) => getComputedStyle(element.querySelector('.tile-name')!).display !== 'none').map((element) => element.getAttribute('data-cell')!));
}

test('[scenario:tile-names] tile names are not drawn by default, show on hover, focus and a long press on a solid plate without taking the tile, a tap still takes it, every cell’s accessible name has its tile, and the Tile names setting shows them all and survives a reload', async ({ page, browser }, testInfo) => {
  test.setTimeout(90_000);
  await startTwoPlayerGame(page);
  const cells = await readBoard(page);

  // Not drawn by default; every free cell's accessible name holds its tile's name, and taken cells their token.
  expect(await shownPlates(page)).toEqual([]);
  for (const cell of cells) expect(cell.label).toContain(`${cell.cell}, ${cell.terrain}–${cell.symbol}`);

  // Hover: the name shows on a solid plate above the wash and the veil, and nothing is taken.
  const inner = cells.find((cell) => cell.cell === 'B2')!;
  await cellAt(page, 'B2').hover();
  expect(await plateOf(page, 'B2')).toEqual({ shown: true, text: `${inner.terrain}–${inner.symbol}`, onTop: true, solid: true, zIndex: '3' });
  expect(await shownPlates(page)).toEqual(['B2']);
  expect(await takeCount(page)).toBe(0);
  await page.mouse.move(0, 0);
  expect(await shownPlates(page)).toEqual([]);

  // Keyboard focus: the focused tile shows its name.
  await page.keyboard.press('Tab');
  for (let i = 0; i < 30 && !(await page.evaluate(() => document.activeElement?.hasAttribute('data-cell'))); i += 1) await page.keyboard.press('Tab');
  const focused = (await page.evaluate(() => document.activeElement?.getAttribute('data-cell')))!;
  expect((await plateOf(page, focused))!.shown).toBe(true);
  await page.keyboard.press('ArrowRight');
  const next = (await page.evaluate(() => document.activeElement?.getAttribute('data-cell')))!;
  expect(await shownPlates(page)).toEqual([next]);

  // The Tile names setting: every free tile shows its name, and the setting survives a reload.
  await page.getByTestId('menu-button').click();
  const setting = page.getByRole('switch', { name: 'Tile names' });
  await expect(setting).toHaveAttribute('aria-checked', 'false');
  await setting.click();
  await expect(setting).toHaveAttribute('aria-checked', 'true');
  await page.getByRole('button', { name: 'Resume' }).click();
  await takeGlowing(page);
  const free = (await readBoard(page)).filter((cell) => cell.owner === null).map((cell) => cell.cell);
  expect(await shownPlates(page)).toEqual(free);
  await attachScreenshot(page, testInfo, 'tile-names');
  await page.reload();
  await page.getByTestId('open-settings').click();
  await expect(page.getByRole('switch', { name: 'Tile names' })).toHaveAttribute('aria-checked', 'true');
  await page.keyboard.press('Escape');
  await page.getByTestId('continue').click();
  expect(await shownPlates(page)).toEqual(free);

  // On a phone: a long press shows the name without taking the tile, and a tap still takes it.
  const phone = await browser.newContext({ baseURL: testInfo.project.use.baseURL!, reducedMotion: 'reduce', viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });
  const touch = await phone.newPage();
  await startTwoPlayerGame(touch);
  const target = (await readBoard(touch)).find((cell) => cell.glow)!;
  const box = (await cellAt(touch, target.cell).boundingBox())!;
  const point = { x: box.x + box.width / 2, y: box.y + box.height / 2 };
  const cdp = await phone.newCDPSession(touch);
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [point] });
  await touch.waitForTimeout(500);
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await expect(cellAt(touch, target.cell)).toHaveAttribute('data-peek', 'true');
  expect(await plateOf(touch, target.cell)).toMatchObject({ shown: true, text: `${target.terrain}–${target.symbol}`, onTop: true, solid: true });
  // Wait past any late click the long press could make: nothing is taken.
  await touch.waitForTimeout(300);
  expect(await takeCount(touch)).toBe(0);
  await expect(cellAt(touch, target.cell)).not.toHaveAttribute('data-owner', /.+/);
  // A normal tap takes the tile.
  await cellAt(touch, target.cell).tap();
  await expect(cellAt(touch, target.cell)).toHaveAttribute('data-owner', 'A');

  // With the setting on at 390 × 844, every plate wraps inside its own tile.
  await touch.getByTestId('menu-button').tap();
  await touch.getByRole('switch', { name: 'Tile names' }).tap();
  await touch.getByRole('button', { name: 'Resume' }).tap();
  const fits = await board(touch)
    .locator('[data-cell][data-taken="false"]')
    .evaluateAll((elements) =>
      elements.map((element) => {
        const plate = element.querySelector('.tile-name') as HTMLElement;
        const box = plate.getBoundingClientRect();
        const cell = element.getBoundingClientRect();
        return {
          cell: element.getAttribute('data-cell'),
          shown: getComputedStyle(plate).display !== 'none',
          scrolls: plate.scrollWidth > plate.clientWidth,
          inside: box.left >= cell.left - 0.5 && box.right <= cell.right + 0.5 && box.top >= cell.top - 0.5 && box.bottom <= cell.bottom + 0.5,
        };
      }),
    );
  expect(fits.length).toBe(15);
  for (const plate of fits) expect(plate, String(plate.cell)).toMatchObject({ shown: true, scrolls: false, inside: true });
  await phone.close();
});

/** The order a line or square lifts in: a line from end to end, a square round its loop. */
function expectedLifts(state: GameState, cell: CellId): CellId[] {
  const next = take(state, cell);
  if (!next.ok || next.state.result?.kind !== 'win' || (next.state.result.by !== 'line' && next.state.result.by !== 'square')) throw new Error('not a winning take');
  const { by, cells } = next.state.result;
  const sorted = [...cells].sort((a, b) => cellRow(a) - cellRow(b) || cellColumn(a) - cellColumn(b));
  return by === 'square' ? [sorted[0]!, sorted[1]!, sorted[3]!, sorted[2]!] : sorted;
}

/** Stores a two-player save one take before `ending` and resumes it with Continue: no event, nothing plays. */
async function resumeBefore(page: Page, ending: Ending) {
  const { state, ends } = nearEnding(ending, 'B');
  await page.evaluate((log) => window.localStorage.setItem('okiya.saved-match', log), JSON.stringify({ version: 3, mode: 'two-player', score: { A: 0, B: 0, draws: 0 }, log: gameLogOfState(state) }));
  await page.reload();
  await page.getByTestId('continue').click();
  await expect(match(page)).toHaveAttribute('data-takes', String(state.takes.length));
  await expect(page.getByTestId('end-screen')).toHaveCount(0);
  return { state, cell: ends[0]! };
}

/**
 * Before the ending take: a listener that pauses every CSS animation of the page the moment the end
 * sequence starts, so the checks below see it mid-way whatever the machine's speed (never the phone's
 * board shrink, a transition); a listener that holds the shrink at its very first frame and measures the
 * board there; a record of the cells' data-end changes; and a record of what a tap or a key press meets.
 */
async function watchTheEnd(page: Page) {
  await page.evaluate(() => {
    const w = window as unknown as {
      __paused: boolean;
      __ends: string[];
      __taps: { target: string | null; boardAnimations: number }[];
      __keys: { key: string; boardAnimations: number }[];
    };
    w.__paused = false;
    w.__ends = [];
    w.__taps = [];
    w.__keys = [];
    document.addEventListener(
      'animationstart',
      (event) => {
        if (w.__paused || !['end-lift', 'end-veil', 'end-settle'].includes(event.animationName)) return;
        w.__paused = true;
        for (const animation of document.getAnimations()) if (animation instanceof CSSAnimation) animation.pause();
      },
      true,
    );
    type Rect = { top: number; left: number; width: number; height: number };
    const v = window as unknown as {
      __shrinks: { duration: number; atZero: Rect }[];
      __plate: { gapDuration: number; atZero: Rect; gapAtZero: number; gapAtHalf: number } | null;
    };
    v.__shrinks = [];
    v.__plate = null;
    const rect = (id: string): Rect => {
      const box = document.querySelector(`[data-testid="${id}"]`)!.getBoundingClientRect();
      return { top: box.top, left: box.left, width: box.width, height: box.height };
    };
    document.addEventListener(
      'transitionrun',
      (event) => {
        if (event.propertyName !== '--board-size') return;
        const transitions = (event.target as Element).getAnimations().filter((animation) => animation instanceof CSSTransition) as CSSTransition[];
        const shrink = transitions.find((animation) => animation.transitionProperty === '--board-size');
        if (!shrink) return;
        // The board's size and Player 1's gap ease together; both are held at their first frame, where the
        // board and the nameplate must be exactly at their mid-game size and place.
        const gap = transitions.find((animation) => animation.transitionProperty === '--seat-gap');
        for (const animation of [shrink, gap]) {
          if (!animation) continue;
          animation.pause();
          animation.currentTime = 0;
        }
        const frame = rect('board-frame');
        const plate = rect('seat-A');
        v.__shrinks.push({ duration: Number(shrink.effect!.getTiming().duration), atZero: frame });
        if (gap) {
          // Half-way the nameplate is still under the board, its gap between the mid-game and the ended one.
          const half = Number(shrink.effect!.getTiming().duration) / 2;
          shrink.currentTime = half;
          gap.currentTime = half;
          const halfFrame = rect('board-frame');
          const halfPlate = rect('seat-A');
          shrink.currentTime = 0;
          gap.currentTime = 0;
          v.__plate = {
            gapDuration: Number(gap.effect!.getTiming().duration),
            atZero: plate,
            gapAtZero: plate.top - (frame.top + frame.height),
            gapAtHalf: halfPlate.top - (halfFrame.top + halfFrame.height),
          };
        }
      },
      true,
    );
    const observer = new MutationObserver((records) => {
      for (const record of records) w.__ends.push(`${(record.target as Element).getAttribute('data-cell')}=${(record.target as Element).getAttribute('data-end')}`);
    });
    for (const cell of document.querySelectorAll('[data-testid="board"] [data-cell]')) observer.observe(cell, { attributes: true, attributeFilter: ['data-end'] });
    window.addEventListener(
      'pointerdown',
      (event) => {
        const board = document.querySelector('[data-testid="board"]');
        const animations = board ? board.getAnimations({ subtree: true }).filter((animation) => animation instanceof CSSAnimation).length : -1;
        w.__taps.push({ target: (event.target as Element).closest('[data-testid]')?.getAttribute('data-testid') ?? null, boardAnimations: animations });
      },
      true,
    );
    window.addEventListener(
      'keydown',
      (event) => {
        const board = document.querySelector('[data-testid="board"]');
        const animations = board ? board.getAnimations({ subtree: true }).filter((animation) => animation instanceof CSSAnimation).length : -1;
        w.__keys.push({ key: event.key, boardAnimations: animations });
      },
      true,
    );
  });
}

/** The end sequence as the page runs it right now. */
async function endNow(page: Page) {
  return page.evaluate(() => {
    const board = document.querySelector('[data-testid="board"]')!;
    // The scenes' own slow loops inside the tiles are not part of the end sequence.
    const all = (document.getAnimations() as CSSAnimation[]).filter((animation) => !String(animation.animationName ?? '').startsWith('scene-'));
    // The board's CSS animations: the sequence (transitions, such as a tile settling back, are not part of it).
    const running = board.getAnimations({ subtree: true }).filter((animation) => animation instanceof CSSAnimation && !animation.animationName.startsWith('scene-')) as CSSAnimation[];
    const lifts = [...board.querySelectorAll('[data-end="lift"]')].map((cell) => {
      const animation = cell.querySelector('[data-testid="token"]')!.getAnimations().find((candidate) => (candidate as CSSAnimation).animationName === 'end-lift');
      return { cell: cell.getAttribute('data-cell')!, order: Number(cell.getAttribute('data-lift-order')), delay: animation ? Number(animation.effect!.getTiming().delay) : null, state: animation?.playState ?? null };
    });
    const veil = (cell: Element) => getComputedStyle(cell.querySelector('.tile-face')!, '::after');
    return {
      kind: board.getAttribute('data-end-kind'),
      skipped: board.getAttribute('data-end-skipped'),
      names: [...new Set(running.map((animation) => animation.animationName))].sort(),
      boardAnimations: running.length,
      transitions: board.getAnimations({ subtree: true }).filter((animation) => !(animation instanceof CSSAnimation)).map((animation) => (animation as CSSTransition).transitionProperty),
      longestEnd: Math.max(0, ...all.map((animation) => Number(animation.effect!.getComputedTiming().endTime))),
      lifts: lifts.sort((a, b) => a.order - b.order),
      dims: [...board.querySelectorAll('[data-end="dim"]')].map((cell) => ({ cell: cell.getAttribute('data-cell')!, veil: veil(cell).backgroundColor })),
      greys: [...board.querySelectorAll('[data-end="grey"]')].map((cell) => ({ cell: cell.getAttribute('data-cell')!, blend: veil(cell).mixBlendMode })),
      settles: board.querySelectorAll('[data-end="settle"]').length,
      liftedAbove: [...board.querySelectorAll('[data-end="lift"]')].every((cell) => {
        const token = cell.querySelector('[data-testid="token"]')!.getBoundingClientRect();
        const box = cell.getBoundingClientRect();
        return token.top + token.height / 2 < box.top + box.height / 2 - 1;
      }),
      stroke: document.querySelector('[data-testid="win-stroke"]')?.getAttribute('data-end') ?? null,
      // How far the stroke's ends lie from the centres of the first and the last lifting cells, in pixels.
      strokeMiss: (() => {
        const path = document.querySelector('[data-testid="win-stroke"] .win-stroke-line') as SVGPathElement | null;
        const order = [...board.querySelectorAll('[data-end="lift"]')].sort((a, b) => Number(a.getAttribute('data-lift-order')) - Number(b.getAttribute('data-lift-order')));
        if (!path || order.length !== 4) return null;
        const matrix = path.getScreenCTM()!;
        const onScreen = (length: number) => new DOMPoint(path.getPointAtLength(length).x, path.getPointAtLength(length).y).matrixTransform(matrix);
        const centre = (cell: Element) => {
          const box = cell.getBoundingClientRect();
          return { x: box.left + box.width / 2, y: box.top + box.height / 2 };
        };
        const miss = (point: DOMPoint, cell: Element) => Math.hypot(point.x - centre(cell).x, point.y - centre(cell).y);
        return Math.max(miss(onScreen(0), order[0]!), path.getAttribute('d')!.endsWith('Z') ? miss(onScreen(path.getTotalLength() * 0.25), order[1]!) : miss(onScreen(path.getTotalLength()), order[3]!));
      })(),
    };
  });
}

/** Where Play again and Home sit, and whether the result card covers a cell, and whether it sits beside or below the board. */
async function resultCard(page: Page) {
  return page.evaluate(() => {
    const box = (id: string) => document.querySelector(`[data-testid="${id}"]`)!.getBoundingClientRect();
    const card = box('end-screen');
    const frame = box('board-frame');
    const covered = [...document.querySelectorAll('[data-testid="board"] [data-cell]')].filter((cell) => {
      const other = cell.getBoundingClientRect();
      return card.left < other.right && other.left < card.right && card.top < other.bottom && other.top < card.bottom;
    }).length;
    const place = (rect: DOMRect) => ({ x: Math.round(rect.x), y: Math.round(rect.y), width: Math.round(rect.width), height: Math.round(rect.height) });
    const playAgain = document.querySelector('[data-testid="play-again"]') as HTMLButtonElement;
    return {
      playAgain: place(box('play-again')),
      home: place(box('end-home')),
      covered,
      beside: card.left >= frame.right,
      below: card.top >= frame.bottom,
      enabled: !playAgain.disabled,
    };
  });
}

type Box = { top: number; left: number; width: number; height: number };

/** The boxes of the phone's column that must never move at the end. */
async function steadyBoxes(page: Page): Promise<Record<string, Box>> {
  return page.evaluate(() =>
    Object.fromEntries(
      ['board-frame', 'scoreboard', 'seat-B', 'seat-A', 'match-card'].map((id) => {
        const box = document.querySelector(`[data-testid="${id}"]`)!.getBoundingClientRect();
        return [id, { top: box.top, left: box.left, width: box.width, height: box.height }];
      }),
    ),
  );
}

/**
 * The phone's end shrink (PRD U6, U10): one transition of the board's size, at most 300 ms, starting at the
 * mid-game size and place with no first-frame snap; then, let finish, the board's top where it was, its
 * centre on the column's, about 300 px wide, the full result card under Player 1's nameplate, nothing
 * overlapping, nothing above the board moved and no vertical scroll. Returns the ended board's box.
 */
async function expectShrink(page: Page, mid: Record<string, Box>) {
  const shrinks = await page.evaluate(() => (window as unknown as { __shrinks: { duration: number; atZero: Box }[] }).__shrinks);
  expect(shrinks, 'one size transition of the board').toHaveLength(1);
  const [{ duration, atZero }] = shrinks as [{ duration: number; atZero: Box }];
  expect(duration).toBeGreaterThan(0);
  expect(duration).toBeLessThanOrEqual(300);
  const frame = mid['board-frame']!;
  for (const key of ['top', 'left', 'width', 'height'] as const) expect(Math.abs(atZero[key] - frame[key]), `at currentTime 0, ${key}`).toBeLessThanOrEqual(1);
  // Player 1's nameplate follows the board's bottom edge: no snap at the first frame, and half-way its gap
  // is between the mid-game gap and the ended one, with the same timing as the board.
  const plate = await page.evaluate(() => (window as unknown as { __plate: { gapDuration: number; atZero: Box; gapAtZero: number; gapAtHalf: number } | null }).__plate);
  expect(plate, 'the nameplate eases with the board').not.toBeNull();
  expect(plate!.gapDuration).toBe(duration);
  const midPlate = mid['seat-A']!;
  for (const key of ['top', 'left', 'width', 'height'] as const) expect(Math.abs(plate!.atZero[key] - midPlate[key]), `seat-A at currentTime 0, ${key}`).toBeLessThanOrEqual(1);
  const midGap = midPlate.top - (frame.top + frame.height);
  expect(Math.abs(plate!.gapAtZero - midGap)).toBeLessThanOrEqual(1);
  // Let it run to its end.
  const easing = ['--board-size', '--seat-gap'];
  await page.evaluate((names) => document.getAnimations().filter((animation) => animation instanceof CSSTransition && names.includes(animation.transitionProperty)).forEach((animation) => animation.finish()), easing);
  await expect.poll(() => page.evaluate((names) => document.getAnimations().filter((animation) => animation instanceof CSSTransition && names.includes(animation.transitionProperty)).length, easing)).toBe(0);
  const after = await steadyBoxes(page);
  const ended = after['board-frame']!;
  expect(Math.abs(ended.top - frame.top), 'the board’s top stays put').toBeLessThanOrEqual(1);
  const column = await page.evaluate(() => window.innerWidth / 2);
  expect(Math.abs(ended.left + ended.width / 2 - column), 'centred on the column').toBeLessThanOrEqual(1);
  expect(ended.width).toBeGreaterThanOrEqual(280);
  expect(ended.width).toBeLessThanOrEqual(320);
  expect(Math.abs(ended.width - ended.height)).toBeLessThanOrEqual(1);
  for (const id of ['scoreboard', 'seat-B', 'match-card']) expect(after[id], `${id} never slides`).toEqual(mid[id]);
  const endGap = after['seat-A']!.top - (ended.top + ended.height);
  expect(endGap).toBeLessThan(midGap);
  expect(plate!.gapAtHalf, 'half-way, the gap is between the mid-game and ended ones').toBeGreaterThan(endGap + 1);
  expect(plate!.gapAtHalf).toBeLessThan(midGap - 1);
  const layout = await page.evaluate(() => {
    const box = (id: string) => document.querySelector(`[data-testid="${id}"]`)!.getBoundingClientRect();
    const [frame, plate, card, detail] = ['board-frame', 'seat-A', 'end-screen', 'result-detail'].map(box) as [DOMRect, DOMRect, DOMRect, DOMRect];
    return {
      plateBelowBoard: plate.top >= frame.bottom,
      cardBelowPlate: card.top >= plate.bottom,
      cardInside: card.top >= 0 && card.bottom <= window.innerHeight && card.left >= 0 && card.right <= window.innerWidth,
      detailInside: detail.bottom <= card.bottom && detail.height > 0,
      scroll: document.documentElement.scrollHeight - window.innerHeight,
      scrolled: window.scrollY,
    };
  });
  expect(layout).toEqual({ plateBelowBoard: true, cardBelowPlate: true, cardInside: true, detailInside: true, scroll: 0, scrolled: 0 });
  return ended;
}

/** Plays one ending with motion on, from a seeded save: checks the sequence mid-way and the result card, and returns where its buttons sit. */
async function playEnding(page: Page, ending: Ending, finish: 'skip' | 'key' | 'play-again', viewport: 'wide' | 'phone') {
  const { state, cell } = await resumeBefore(page, ending);
  await watchTheEnd(page);
  const mid = await steadyBoxes(page);
  const centre = (await cellAt(page, cell).boundingBox())!;
  await page.mouse.click(centre.x + centre.width / 2, centre.y + centre.height / 2);
  await expect(page.getByTestId('end-screen')).toBeVisible();
  await expect.poll(() => page.evaluate(() => (window as unknown as { __paused: boolean }).__paused), { message: 'the end sequence started' }).toBe(true);
  // On a phone the board shrinks to make room for the result card; its positions are compared after it.
  let ended: Box | null = null;
  if (viewport === 'phone') ended = await expectShrink(page, mid);
  else expect(await page.evaluate(() => (window as unknown as { __shrinks: unknown[] }).__shrinks)).toEqual([]);

  // Mid-way: the sequence runs on the board, and the whole of it ends within 700 ms.
  const now = await endNow(page);
  expect(now.kind).toBe(ending);
  expect(now.skipped).toBe('false');
  expect(now.boardAnimations).toBeGreaterThan(0);
  expect(now.longestEnd).toBeLessThanOrEqual(700);
  const ends = await page.evaluate(() => (window as unknown as { __ends: string[] }).__ends);
  if (ending === 'shape') {
    // The four winning tokens lift one after another, the stroke is drawn, the other twelve cells dim.
    const lifts = expectedLifts(state, cell);
    expect(now.lifts.map((lift) => lift.cell)).toEqual(lifts);
    const delays = now.lifts.map((lift) => lift.delay!);
    expect(delays.every((delay, index) => index === 0 || delay > delays[index - 1]!)).toBe(true);
    expect(now.names).toEqual(expect.arrayContaining(['end-lift', 'end-veil', 'stroke-draw']));
    expect(now.stroke).toBe('stroke');
    // The stroke runs through the winning cells' centres, where the tokens sit.
    expect(now.strokeMiss).not.toBeNull();
    expect(now.strokeMiss!).toBeLessThan(4);
    expect(now.dims).toHaveLength(12);
    for (const dim of now.dims) expect(dim.veil, dim.cell).not.toMatch(/^rgba\(0, 0, 0, 0\)$/);
    expect(ends.filter((entry) => entry.endsWith('=lift'))).toHaveLength(4);
  } else if (ending === 'blockade') {
    // The Match card says that no tile matches, and the remaining free tiles grey out.
    const last = (await readBoard(page)).find((entry) => entry.cell === cell)!;
    const sentence = `No tile matches ${last.terrain}–${last.symbol}`;
    await expect(page.getByTestId('match-card')).toHaveAttribute('aria-label', sentence);
    // The whole sentence on a wide screen; a phone's fixed card says it in one short line.
    const shown = page.getByTestId('match-card-blocked').locator(viewport === 'wide' ? '.long-form' : '.short-form');
    await expect(shown).toBeVisible();
    await expect(shown).toHaveText(viewport === 'wide' ? sentence : 'No match');
    await expect(page.getByTestId('match-card-blocked').locator(viewport === 'wide' ? '.short-form' : '.long-form')).toBeHidden();
    const free = (await readBoard(page)).filter((entry) => entry.owner === null).map((entry) => entry.cell);
    expect(now.greys.map((grey) => grey.cell)).toEqual(free);
    for (const grey of now.greys) expect(grey.blend).toBe('saturation');
    expect(now.names).toEqual(expect.arrayContaining(['end-veil']));
    expect(now.lifts).toEqual([]);
  } else {
    // A draw: every cell settles evenly.
    expect(now.settles).toBe(16);
    expect(now.names).toEqual(expect.arrayContaining(['end-settle']));
  }

  // The result card is there at once, beside the board (below it on a phone), covering no cell, and takes taps.
  const card = await resultCard(page);
  expect(card.covered).toBe(0);
  expect(viewport === 'wide' ? card.beside : card.below).toBe(true);
  expect(card.enabled).toBe(true);

  if (finish === 'skip') {
    // A tap anywhere skips the sequence to its final frame.
    const plate = (await seat(page, 'A').boundingBox())!;
    await page.mouse.click(plate.x + plate.width / 2, plate.y + plate.height / 2);
    await expect(board(page)).toHaveAttribute('data-end-skipped', 'true');
    const after = await endNow(page);
    expect(after.boardAnimations).toBe(0);
    if (ending === 'shape') expect(after.liftedAbove).toBe(true);
    // Let the rest of the page (the avatars, the Match card) finish what the pause held.
    await page.evaluate(() => document.getAnimations().filter((animation) => Number.isFinite(Number(animation.effect!.getComputedTiming().endTime))).forEach((animation) => animation.finish()));
    const taps = await page.evaluate(() => (window as unknown as { __taps: { target: string | null; boardAnimations: number }[] }).__taps);
    expect(taps.at(-1)!.boardAnimations).toBeGreaterThan(0);
  } else if (finish === 'key') {
    // A key press skips the sequence to its final frame too, and the key meets the sequence still running.
    await page.keyboard.press('Shift');
    await expect(board(page)).toHaveAttribute('data-end-skipped', 'true');
    const after = await endNow(page);
    expect(after.boardAnimations).toBe(0);
    if (ending === 'shape') expect(after.liftedAbove).toBe(true);
    await page.evaluate(() => document.getAnimations().filter((animation) => Number.isFinite(Number(animation.effect!.getComputedTiming().endTime))).forEach((animation) => animation.finish()));
    const keys = await page.evaluate(() => (window as unknown as { __keys: { key: string; boardAnimations: number }[] }).__keys);
    expect(keys.at(-1)).toMatchObject({ key: 'Shift' });
    expect(keys.at(-1)!.boardAnimations).toBeGreaterThan(0);
  } else {
    // Play again takes a tap during the sequence: the tap meets it with the sequence still on the board.
    await page.getByTestId('play-again').click();
    await expect(page.getByTestId('end-screen')).toHaveCount(0);
    await expect(match(page)).toHaveAttribute('data-takes', '0');
    // Back to full size at once: no size transition runs on the new game.
    expect(await page.evaluate(() => document.getAnimations().filter((animation) => animation instanceof CSSTransition && animation.transitionProperty === '--board-size').length)).toBe(0);
    if (ended) expect((await steadyBoxes(page))['board-frame']).toEqual(mid['board-frame']);
    const taps = await page.evaluate(() => (window as unknown as { __taps: { target: string | null; boardAnimations: number }[] }).__taps);
    expect(taps.at(-1)).toMatchObject({ target: 'play-again' });
    expect(taps.at(-1)!.boardAnimations).toBeGreaterThan(0);
  }
  return { ...card, ended };
}

test('[scenario:end-sequence] with motion on, a win lifts its tokens in order and dims the rest, a blockade greys the free tiles and says no tile matches, a draw settles; the result card shows at once beside the board (below it on a phone) without covering a cell, Play again works during the sequence, a tap skips it, it ends within 700 ms, and the buttons keep their places', async ({ page }, testInfo) => {
  test.setTimeout(120_000);
  await openHome(page);
  await page.emulateMedia({ reducedMotion: 'no-preference' });

  // Wide: a line or square, skipped by a tap; a blockade, ended by Play again mid-way; a draw, skipped by a key.
  const shape = await playEnding(page, 'shape', 'skip', 'wide');
  await attachScreenshot(page, testInfo, 'end-sequence');
  const blockade = await playEnding(page, 'blockade', 'play-again', 'wide');
  const draw = await playEnding(page, 'draw', 'key', 'wide');
  for (const other of [blockade, draw]) {
    expect(other.playAgain).toEqual(shape.playAgain);
    expect(other.home).toEqual(shape.home);
  }

  // At 390 × 844 the card sits below the board, and the buttons keep their places in every ending there too.
  await page.setViewportSize({ width: 390, height: 844 });
  const phoneShape = await playEnding(page, 'shape', 'play-again', 'phone');
  const phoneBlockade = await playEnding(page, 'blockade', 'skip', 'phone');
  const phoneDraw = await playEnding(page, 'draw', 'skip', 'phone');
  for (const other of [phoneBlockade, phoneDraw]) {
    expect(other.playAgain).toEqual(phoneShape.playAgain);
    expect(other.home).toEqual(phoneShape.home);
  }

  // Under reduced motion the final frame shows at once: nothing runs on the board, and on a phone the board
  // takes its ended size with no transition, the same layout as with motion.
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await resumeBefore(page, 'shape').then(async ({ cell }) => {
    await watchTheEnd(page);
    await cellAt(page, cell).click();
    await expect(page.getByTestId('end-screen')).toBeVisible();
    expect((await endNow(page)).boardAnimations).toBe(0);
    expect((await endNow(page)).liftedAbove).toBe(true);
    expect(await page.evaluate(() => (window as unknown as { __shrinks: unknown[] }).__shrinks)).toEqual([]);
    expect(await page.evaluate(() => document.getAnimations().length)).toBe(0);
    const frame = (await steadyBoxes(page))['board-frame']!;
    for (const key of ['top', 'left', 'width', 'height'] as const) expect(Math.abs(frame[key] - phoneShape.ended![key]), key).toBeLessThanOrEqual(1);
    const card = await resultCard(page);
    expect(card.playAgain).toEqual(phoneShape.playAgain);
    expect(card.home).toEqual(phoneShape.home);
  });
  await expect(glowing(page)).toHaveCount(0);
});
