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

/** The look of every cell as the page paints it: lift, wash, veil, outline, border and opacity. */
async function cellLooks(page: Page) {
  return board(page)
    .locator('[data-cell]')
    .evaluateAll((elements) => {
      const parse = (value: string): Rgba => {
        const parts = value.match(/-?[\d.]+(?:e-?\d+)?/g)?.map(Number) ?? [0, 0, 0, 0];
        const scale = value.startsWith('color(') ? 255 : 1;
        return { r: parts[0]! * scale, g: parts[1]! * scale, b: parts[2]! * scale, a: parts.length > 3 ? parts[3]! : 1 };
      };
      return elements.map((element) => {
        const style = getComputedStyle(element);
        const face = element.querySelector('.tile-face')!;
        return {
          cell: element.getAttribute('data-cell')!,
          glow: element.getAttribute('data-glow') === 'true',
          faded: element.getAttribute('data-faded') === 'true',
          taken: element.getAttribute('data-taken') === 'true',
          last: element.getAttribute('data-last') === 'true',
          translate: style.translate,
          opacity: Number(style.opacity),
          faceOpacity: Number(getComputedStyle(face).opacity),
          outline: style.outlineStyle,
          border: parse(style.borderTopColor),
          background: style.backgroundColor,
          wash: parse(getComputedStyle(face, '::before').backgroundColor),
          veil: parse(getComputedStyle(face, '::after').backgroundColor),
        };
      });
    });
}

/** A seat's border colour (its player's colour when lit) as channels. */
async function seatColour(page: Page, player: 'A' | 'B'): Promise<Rgba> {
  return seat(page, player).evaluate((element) => {
    const parts = getComputedStyle(element).borderTopColor.match(/[\d.]+/g)!.map(Number);
    return { r: parts[0]!, g: parts[1]!, b: parts[2]!, a: 1 };
  });
}

const sameColour = (a: Rgba, b: Rgba) => Math.abs(a.r - b.r) < 2 && Math.abs(a.g - b.g) < 2 && Math.abs(a.b - b.b) < 2;

/**
 * With highlights on and a person to move: the legal tiles keep full brightness, lift and carry a light
 * wash of the mover's colour with no outline or border in it, the other free tiles fade under a veil while
 * the cell itself stays opaque, the taken cells do not fade, and the last take is one warm tint.
 */
async function expectLegalLook(page: Page, mover: 'A' | 'B') {
  const { legal } = await legalFromPage(page);
  const looks = await cellLooks(page);
  const colour = await seatColour(page, mover);
  expect(looks.filter((look) => look.glow).map((look) => look.cell)).toEqual(legal);
  for (const look of looks) {
    expect(look.opacity, look.cell).toBe(1);
    expect(look.faceOpacity, look.cell).toBe(1);
    expect(look.outline, look.cell).toBe('none');
    expect(sameColour(look.border, colour), `${look.cell} has no border in the mover's colour`).toBe(false);
    if (look.glow) {
      expect(look.translate, look.cell).toMatch(/^0px -[1-9]\d*(\.\d+)?px$/);
      expect(sameColour(look.wash, colour), `${look.cell} washes in the mover's colour`).toBe(true);
      expect(look.wash.a, look.cell).toBeGreaterThanOrEqual(0.1);
      expect(look.wash.a, look.cell).toBeLessThanOrEqual(0.2);
      expect(look.veil.a, look.cell).toBe(0);
    } else {
      expect(look.translate, look.cell).toMatch(/^(none|0px)$/);
      expect(look.wash.a, look.cell).toBe(0);
    }
    if (look.taken) {
      expect(look.faded, look.cell).toBe(false);
      expect(look.veil.a, look.cell).toBe(0);
    } else if (!look.glow) {
      expect(look.faded, look.cell).toBe(true);
      // A veil of the ground at about 45% leaves the art at about 55%.
      expect(look.veil.a, look.cell).toBeGreaterThanOrEqual(0.35);
      expect(look.veil.a, look.cell).toBeLessThanOrEqual(0.55);
    }
  }
  // The last take: one warm tint on its cell, not the bare slot of the other taken cells, and no mark on it.
  const last = looks.filter((look) => look.last);
  expect(last).toHaveLength(1);
  for (const other of looks.filter((look) => look.taken && !look.last)) expect(other.background).not.toBe(last[0]!.background);
  await expect(board(page).locator('.last-mark, .winning-mark')).toHaveCount(0);
  expect(await cellAt(page, last[0]!.cell).evaluate((element) => getComputedStyle(element).outlineStyle)).toBe('none');
}

test('[scenario:legal-tiles] with highlights on the legal tiles keep full brightness, lift and carry a wash of the mover’s colour with no outline, the others fade, taken cells do not, and the last take is one warm tint, wide and at 390 × 844, the wash following the mover', async ({ page }, testInfo) => {
  test.setTimeout(90_000);
  await startGame(page);
  await takeGlowing(page);
  await waitForHumanTurn(page);
  await expectLegalLook(page, 'A');
  await expect(board(page)).toHaveAttribute('data-glow-player', 'A');
  await attachScreenshot(page, testInfo, 'legal-tiles');

  // At 390 × 844 the same look.
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(seat(page, 'A')).toBeVisible();
  await expectLegalLook(page, 'A');

  // In a two-player game the wash follows the mover: Player 1's blue, then Player 2's red.
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
  if (!next.ok || next.state.result?.kind !== 'win' || next.state.result.by === 'blockade') throw new Error('not a winning take');
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
 * Before the ending take: a listener that pauses every animation of the page the moment the end
 * sequence starts, so the checks below see it mid-way whatever the machine's speed; a record of the
 * cells' data-end changes; and a record of what a tap or a key press meets.
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
        for (const animation of document.getAnimations()) animation.pause();
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
    const all = document.getAnimations() as CSSAnimation[];
    // The board's CSS animations: the sequence (transitions, such as a tile settling back, are not part of it).
    const running = board.getAnimations({ subtree: true }).filter((animation) => animation instanceof CSSAnimation) as CSSAnimation[];
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

/** Plays one ending with motion on, from a seeded save: checks the sequence mid-way and the result card, and returns where its buttons sit. */
async function playEnding(page: Page, ending: Ending, finish: 'skip' | 'key' | 'play-again', viewport: 'wide' | 'phone') {
  const { state, cell } = await resumeBefore(page, ending);
  await watchTheEnd(page);
  const centre = (await cellAt(page, cell).boundingBox())!;
  await page.mouse.click(centre.x + centre.width / 2, centre.y + centre.height / 2);
  await expect(page.getByTestId('end-screen')).toBeVisible();
  await expect.poll(() => page.evaluate(() => (window as unknown as { __paused: boolean }).__paused), { message: 'the end sequence started' }).toBe(true);

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
    await expect(page.getByTestId('match-card-blocked')).toHaveText(`No tile matches ${last.terrain}–${last.symbol}`);
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
    await page.evaluate(() => document.getAnimations().forEach((animation) => animation.finish()));
    const taps = await page.evaluate(() => (window as unknown as { __taps: { target: string | null; boardAnimations: number }[] }).__taps);
    expect(taps.at(-1)!.boardAnimations).toBeGreaterThan(0);
  } else if (finish === 'key') {
    // A key press skips the sequence to its final frame too, and the key meets the sequence still running.
    await page.keyboard.press('Shift');
    await expect(board(page)).toHaveAttribute('data-end-skipped', 'true');
    const after = await endNow(page);
    expect(after.boardAnimations).toBe(0);
    if (ending === 'shape') expect(after.liftedAbove).toBe(true);
    await page.evaluate(() => document.getAnimations().forEach((animation) => animation.finish()));
    const keys = await page.evaluate(() => (window as unknown as { __keys: { key: string; boardAnimations: number }[] }).__keys);
    expect(keys.at(-1)).toMatchObject({ key: 'Shift' });
    expect(keys.at(-1)!.boardAnimations).toBeGreaterThan(0);
  } else {
    // Play again takes a tap during the sequence: the tap meets it with the sequence still on the board.
    await page.getByTestId('play-again').click();
    await expect(page.getByTestId('end-screen')).toHaveCount(0);
    await expect(match(page)).toHaveAttribute('data-takes', '0');
    const taps = await page.evaluate(() => (window as unknown as { __taps: { target: string | null; boardAnimations: number }[] }).__taps);
    expect(taps.at(-1)).toMatchObject({ target: 'play-again' });
    expect(taps.at(-1)!.boardAnimations).toBeGreaterThan(0);
  }
  return card;
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

  // Under reduced motion the final frame shows at once: nothing runs on the board.
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await resumeBefore(page, 'shape').then(async ({ cell }) => {
    await cellAt(page, cell).click();
    await expect(page.getByTestId('end-screen')).toBeVisible();
    expect((await endNow(page)).boardAnimations).toBe(0);
    expect((await endNow(page)).liftedAbove).toBe(true);
  });
  await expect(glowing(page)).toHaveCount(0);
});
