/// <reference lib="dom" />
// The DOM library types the callbacks that run in the page (page.evaluate).
import { expect, test, type Page } from '@playwright/test';
import {
  attachScreenshot,
  boardSpacing,
  BOT_REPLY_MS,
  cellAt,
  glowing,
  HUMAN_STARTS,
  legalFromPage,
  match,
  nearWin,
  playButton,
  readBoard,
  recordedLooks,
  recordReactions,
  refusalToast,
  seat,
  seatLooks,
  seedSavedGame,
  startGame,
  startTwoPlayerGame,
  takeCount,
  takeGlowing,
  takeToast,
  toasts,
  toastsOverCells,
  waitForHumanTurn,
  continueSaved,
  type PageCell,
  type SeatLook,
} from './helpers';
import { newGame } from '@okiya/game';
import { FADE_MS, TOAST_MS } from '../../apps/web/src/toasts';

// The game's feel (PRD U1, U3, U9): the avatars' reactions, the table's materials and toasts that never
// cover a tile. Randomness is fixed per test; tiles, tokens, seats and reactions are read from the page,
// and only the scenarios that turn motion on look at an animation.

type Looks = { A: SeatLook; B: SeatLook };

/** The animation a seat's moving avatar group runs (or ran last), from its computed style. */
async function motionName(page: Page, player: 'A' | 'B') {
  return page.locator(`[data-testid="avatar-${player}"] .avatar-motion`).evaluate((element) => getComputedStyle(element).animationName);
}

/** Whether some recorded snapshot matches every given field of either seat. */
function seen(looks: Looks[], want: { A?: Partial<SeatLook>; B?: Partial<SeatLook> }) {
  return looks.findIndex((look) => (['A', 'B'] as const).every((player) => Object.entries(want[player] ?? {}).every(([field, value]) => look[player][field as keyof SeatLook] === value)));
}

test('[scenario:avatar-reactions] with motion on, the avatars react to what just happened: ready, thinking, a nod, a glance, a wince, and the winner’s bounce on the won face', async ({ page }, testInfo) => {
  test.setTimeout(90_000);
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await startGame(page, { seed: HUMAN_STARTS, difficulty: 'Easy' });

  // The start of a game is no event: the player to move is ready, the bot waits, nobody moves.
  expect(await seatLooks(page)).toEqual({ A: { expression: 'to-move', reaction: null, key: '0' }, B: { expression: 'idle', reaction: null, key: '0' } });
  await expect(page.locator('[data-testid="avatar-A"]')).toHaveAttribute('data-expression', 'to-move');

  // Your take: you nod, and the bot glances at it while it thinks; then the bot takes, nods, and you glance.
  await recordReactions(page);
  await takeGlowing(page);
  await waitForHumanTurn(page);
  const afterTakes = await recordedLooks(page);
  const yourTake = seen(afterTakes, { A: { expression: 'idle', reaction: 'nod' }, B: { expression: 'thinking', reaction: 'glance' } });
  const botTake = seen(afterTakes, { A: { expression: 'to-move', reaction: 'glance' }, B: { expression: 'idle', reaction: 'nod' } });
  expect(yourTake, JSON.stringify(afterTakes)).toBeGreaterThanOrEqual(0);
  expect(botTake, JSON.stringify(afterTakes)).toBeGreaterThan(yourTake);
  // Each motion is a CSS animation read from data-reaction: Player 1 glances right, at the board and the bot.
  expect(await motionName(page, 'A')).toBe('avatar-glance-right');
  expect(await motionName(page, 'B')).toBe('avatar-nod');
  const keyAfterTakes = Number((await seatLooks(page)).A.key);
  expect(keyAfterTakes).toBe(2);

  // A refused tap makes you wince and the bot does nothing; a second refusal plays the wince again.
  const { illegal } = await legalFromPage(page);
  await recordReactions(page);
  await cellAt(page, illegal[0]!.cell).click();
  await expect(refusalToast(page)).toBeVisible();
  expect(await seatLooks(page)).toEqual({ A: { expression: 'to-move', reaction: 'wince', key: String(keyAfterTakes + 1) }, B: { expression: 'idle', reaction: null, key: String(keyAfterTakes + 1) } });
  expect(await motionName(page, 'A')).toBe('avatar-wince');
  // The other seat gets no reaction, and nothing on its avatar moves.
  expect(await page.getByTestId('avatar-B').evaluate((element) => element.getAnimations({ subtree: true }).length)).toBe(0);
  // Mark the moving group, so a replayed motion shows as a new element.
  await page.locator('[data-testid="avatar-A"] .avatar-motion').evaluate((element) => element.setAttribute('data-test-old', 'true'));
  await cellAt(page, illegal[0]!.cell).click();
  await expect(seat(page, 'A')).toHaveAttribute('data-reaction-key', String(keyAfterTakes + 2));
  await expect(seat(page, 'A')).toHaveAttribute('data-reaction', 'wince');
  await expect(page.locator('[data-testid="avatar-A"] .avatar-motion[data-test-old]')).toHaveCount(0);
  await expect(page.locator('[data-testid="avatar-A"] .avatar-motion[data-motion="wince"]')).toHaveCount(1);
  const refusals = await recordedLooks(page);
  expect(refusals.filter((look) => look.A.reaction === 'wince').map((look) => look.A.key)).toEqual(expect.arrayContaining([String(keyAfterTakes + 1), String(keyAfterTakes + 2)]));
  // The first snapshot is from before the taps, with the bot's nod at its own take; after them it is still.
  expect(refusals.slice(1).length).toBeGreaterThan(0);
  expect(refusals.slice(1).every((look) => look.B.reaction === null)).toBe(true);
  await attachScreenshot(page, testInfo, 'avatar-reactions');

  // Taps on the board still land while the wince plays: a glowing tile is taken at once.
  const before = await takeCount(page);
  const target = (await readBoard(page)).find((cell) => cell.glow)!.cell;
  await cellAt(page, target).click();
  await expect(cellAt(page, target)).toHaveAttribute('data-owner', 'A');
  expect(await takeCount(page)).toBe(before + 1);
  await waitForHumanTurn(page);

  // The end: a saved bot game where the bot wins with its next take, resumed with Continue. A resumed game
  // is no event; then the bot thinks, wins with a bounce on its won face, and you show the lost face.
  const ending = nearWin('B');
  await seedSavedGame(page, ending.state, 'bot');
  await page.evaluate(() => window.sessionStorage.removeItem('test.seeded'));
  await page.reload();
  await page.getByTestId('continue').click();
  await expect(match(page)).toHaveAttribute('data-takes', String(ending.state.takes.length));
  await recordReactions(page);
  const resumed = (await recordedLooks(page))[0]!;
  // The bot may already be choosing; either way nothing moves on a resumed game until the next take.
  expect(resumed.A.reaction).toBeNull();
  expect(resumed.B.reaction).toBeNull();
  await expect(page.getByTestId('end-screen')).toBeVisible({ timeout: BOT_REPLY_MS });
  const end = await recordedLooks(page);
  expect(seen(end, { B: { expression: 'thinking' } }), JSON.stringify(end)).toBeGreaterThanOrEqual(0);
  expect(await seatLooks(page)).toEqual({ A: { expression: 'lost', reaction: null, key: '1' }, B: { expression: 'won', reaction: 'bounce', key: '1' } });
  expect(await motionName(page, 'B')).toBe('avatar-bounce');
  await expect(page.getByTestId('avatar-B')).toHaveAttribute('data-expression', 'won');
  await expect(page.getByTestId('avatar-B')).toHaveAttribute('data-reaction', 'bounce');
  await expect(page.getByTestId('avatar-A')).toHaveAttribute('data-expression', 'lost');
  await expect(page.getByTestId('avatar-A')).not.toHaveAttribute('data-reaction', /.+/);
  // No reaction blocks input: every moving group lets taps through.
  for (const player of ['A', 'B'] as const) {
    expect(await page.locator(`[data-testid="avatar-${player}"] .avatar-motion`).evaluate((element) => getComputedStyle(element).pointerEvents)).toBe('none');
  }
});

/** The orthogonal neighbours of a cell. */
function neighbours(cell: string): string[] {
  const row = cell.charCodeAt(0);
  const column = Number(cell[1]);
  return [
    [row - 1, column],
    [row + 1, column],
    [row, column - 1],
    [row, column + 1],
  ]
    .filter(([r, c]) => r! >= 65 && r! <= 68 && c! >= 1 && c! <= 4)
    .map(([r, c]) => `${String.fromCharCode(r!)}${c}`);
}

/**
 * A glowing take whose tile leaves a neighbouring tile glowing for the other player, worked out from the
 * page alone: the next player's legal takes are the free tiles sharing the taken tile's terrain or symbol.
 */
function takeWithGlowingNeighbour(cells: readonly PageCell[]): { take: string; neighbour: string } | null {
  for (const candidate of cells.filter((cell) => cell.glow)) {
    for (const id of neighbours(candidate.cell)) {
      const other = cells.find((cell) => cell.cell === id)!;
      if (other.owner === null && (other.terrain === candidate.terrain || other.symbol === candidate.symbol)) return { take: candidate.cell, neighbour: id };
    }
  }
  return null;
}

/** The materials of the table as the page paints them. */
async function readMaterials(page: Page) {
  return page.evaluate(() => {
    const style = (element: Element) => getComputedStyle(element);
    /** Box shadows split at commas outside parentheses. */
    const shadows = (value: string) => (value === 'none' ? [] : value.split(/,(?![^(]*\))/).map((part) => part.trim()));
    const table = style(document.querySelector('[data-testid="match-screen"]')!);
    const frame = style(document.querySelector('[data-testid="board-frame"]')!);
    const tile = document.querySelector('[data-testid="board"] [data-cell][data-taken="false"]')!;
    const tokens = [...document.querySelectorAll('[data-testid="board"] [data-testid="token"]')].map((token) => ({
      owner: token.getAttribute('data-owner'),
      colour: style(token).backgroundColor,
      image: style(token).backgroundImage,
      shadows: shadows(style(token).boxShadow),
      mark: token.querySelector('svg.token-mark')?.getAttribute('data-shape') ?? null,
    }));
    const avatars = ['A', 'B'].map((player) => {
      const avatar = document.querySelector(`[data-testid="avatar-${player}"]`)!;
      return {
        shading: [...avatar.querySelectorAll('[data-shading]')].map((part) => Number(part.getAttribute('opacity'))),
        firstFill: style(avatar.querySelector('path')!).fill,
        disc: style(avatar).backgroundImage,
      };
    });
    const everything = [...document.querySelectorAll('*')];
    const ids = everything.map((element) => element.id).filter((id) => id !== '');
    return {
      ground: table.backgroundImage,
      groundColour: table.backgroundColor,
      bodyGround: style(document.body).backgroundImage,
      groundSize: table.backgroundSize,
      overlays: ['::before', '::after'].map((pseudo) => getComputedStyle(document.querySelector('[data-testid="match-screen"]')!, pseudo).content),
      wood: frame.backgroundImage,
      woodColour: frame.backgroundColor,
      tile: { colour: style(tile).backgroundColor, shadows: shadows(style(tile).boxShadow), filter: style(tile).filter },
      tokens,
      avatars,
      blurred: everything.filter((element) => /blur\(/.test(style(element).filter) || (style(element).backdropFilter ?? 'none') !== 'none').map((element) => element.className),
      duplicateIds: ids.filter((id, index) => ids.indexOf(id) !== index),
      svgDefs: document.querySelectorAll('defs, pattern, linearGradient, radialGradient').length,
    };
  });
}

function expectMaterials(materials: Awaited<ReturnType<typeof readMaterials>>) {
  // The calm ground: solid paper or slate under radial layers only (grain dots, one glow, a vignette),
  // no felt and no repeating or directional pattern, on the screen itself with nothing laid over it.
  expect(materials.ground).toMatch(/radial-gradient/);
  expect(materials.ground).not.toMatch(/repeating-|linear-gradient|conic-gradient/);
  expect(materials.ground.match(/radial-gradient/g)!.length).toBe(4);
  expect(materials.bodyGround).toBe(materials.ground);
  expect(materials.groundColour).toMatch(/^rgb\(/);
  expect(materials.overlays).toEqual(['none', 'none']);
  // The grain tiles at two co-prime sizes; the glow and the vignette cover the screen.
  expect(materials.groundSize).toBe('5px 5px, 7px 7px, 100% 100%, 100% 100%');
  // Wood: a repeating grain across the frame over its solid colour.
  expect(materials.wood).toMatch(/^repeating-linear-gradient/);
  expect(materials.woodColour).not.toBe(materials.groundColour);
  // Tiles: an edge (inset shadows) and depth (an outer shadow), and no filter on a cell.
  expect(materials.tile.shadows.filter((shadow) => shadow.endsWith('inset')).length).toBeGreaterThanOrEqual(1);
  expect(materials.tile.shadows.filter((shadow) => !shadow.endsWith('inset')).length).toBeGreaterThanOrEqual(1);
  expect(materials.tile.filter).toBe('none');
  // Tokens: a bevel over a solid colour, with the ring and the diamond.
  expect(materials.tokens.length).toBeGreaterThanOrEqual(2);
  for (const token of materials.tokens) {
    expect(token.image).toMatch(/radial-gradient/);
    expect(token.colour).toMatch(/^rgb\(/);
    expect(token.shadows.some((shadow) => shadow.endsWith('inset'))).toBe(true);
    expect(token.mark).toBe(token.owner === 'A' ? 'ring' : 'diamond');
  }
  expect(new Set(materials.tokens.map((token) => token.colour)).size).toBe(2);
  // Avatars: shading paths at partial opacity over solid fills that tell the players apart.
  for (const avatar of materials.avatars) {
    expect(avatar.shading.length).toBeGreaterThanOrEqual(3);
    for (const opacity of avatar.shading) expect(opacity).toBeLessThan(1);
    expect(avatar.disc).toMatch(/radial-gradient/);
  }
  expect(materials.avatars[0]!.firstFill).not.toBe(materials.avatars[1]!.firstFill);
  // Static and fast: no blur filter or backdrop filter anywhere, no SVG defs, and no duplicate ids.
  expect(materials.blurred).toEqual([]);
  expect(materials.svgDefs).toBe(0);
  expect(materials.duplicateIds).toEqual([]);
}

test('[scenario:table-materials] the board shows separate raised tiles 10 to 14 percent of a tile apart with the same padding, bevelled tokens with their marks and shaded avatars over a calm ground with no felt or pattern, wide and at 390 × 844, with no blur and no duplicate ids; a placed token drops inside its cell and takes no taps', async ({ page }, testInfo) => {
  test.setTimeout(60_000);
  await startTwoPlayerGame(page, { seed: HUMAN_STARTS });

  // The token drop, with motion on, in a two-player game so the next tap is a person's: Player 1 takes a
  // tile that leaves a neighbouring tile glowing for Player 2, and Player 2 taps that neighbour mid-drop.
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  const choice = takeWithGlowingNeighbour(await readBoard(page));
  expect(choice, 'a glowing take with a neighbour that will glow next').not.toBeNull();
  // Hold the drop where it starts, so the tap below lands during it whatever the machine's speed.
  await page.evaluate(() => {
    const hold = (event: AnimationEvent) => {
      if (event.animationName !== 'token-drop') return;
      document.removeEventListener('animationstart', hold);
      for (const animation of (event.target as Element).getAnimations()) animation.pause();
    };
    document.addEventListener('animationstart', hold);
  });
  await cellAt(page, choice!.take).click();
  await expect(cellAt(page, choice!.take)).toHaveAttribute('data-owner', 'A');
  await expect(cellAt(page, choice!.neighbour)).toHaveAttribute('data-glow', 'true');
  const drop = await page.evaluate(
    ({ taken, neighbour }) => {
      const token = document.querySelector(`[data-testid="board"] [data-cell="${taken}"] [data-testid="token"]`)!;
      const animations = token.getAnimations() as CSSAnimation[];
      // Still dropping (held at its start, or not yet started when the event comes late), never finished.
      const states = animations.map((animation) => animation.playState);
      // Hold it midway through the drop.
      for (const animation of animations) {
        animation.pause();
        animation.currentTime = 120;
      }
      const cell = document.querySelector(`[data-testid="board"] [data-cell="${taken}"]`)!.getBoundingClientRect();
      const box = token.getBoundingClientRect();
      const target = document.querySelector(`[data-testid="board"] [data-cell="${neighbour}"]`)!;
      const centre = target.getBoundingClientRect();
      const x = centre.left + centre.width / 2;
      const y = centre.top + centre.height / 2;
      const hit = document.elementFromPoint(x, y);
      return {
        names: animations.map((animation) => animation.animationName),
        states,
        // The token is clipped by its own cell, so nothing of it shows outside the cell's box.
        clipped: getComputedStyle(token.closest('[data-cell]')!).overflow === 'hidden',
        inside: box.left >= cell.left - 1 && box.right <= cell.right + 1,
        pointerEvents: getComputedStyle(token).pointerEvents,
        hitsNeighbour: hit !== null && target.contains(hit),
        x,
        y,
      };
    },
    { taken: choice!.take, neighbour: choice!.neighbour },
  );
  expect(drop.names).toEqual(['token-drop']);
  expect(drop.states).toHaveLength(1);
  expect(['paused', 'running']).toContain(drop.states[0]);
  expect(drop.clipped).toBe(true);
  expect(drop.inside).toBe(true);
  expect(drop.pointerEvents).toBe('none');
  expect(drop.hitsNeighbour).toBe(true);
  await page.mouse.click(drop.x, drop.y);
  await expect(cellAt(page, choice!.neighbour)).toHaveAttribute('data-owner', 'B');
  // The held drop then settles.
  await page.evaluate(() => document.querySelectorAll('[data-testid="token"]').forEach((token) => token.getAnimations().forEach((animation) => animation.finish())));
  await page.emulateMedia({ reducedMotion: 'reduce' });

  // The materials and the spacing at the default wide viewport.
  expectMaterials(await readMaterials(page));
  expectSpacing(await boardSpacing(page));
  await attachScreenshot(page, testInfo, 'table-materials');

  // And at 390 × 844, where every tile stays at least 44 px.
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(seat(page, 'B')).toBeVisible();
  expectMaterials(await readMaterials(page));
  const phone = await boardSpacing(page);
  expectSpacing(phone);
  expect(phone.tile).toBeGreaterThanOrEqual(44);
});

/** Tiles 10 to 14 percent of a tile apart, across and down, with the same padding round them on the board. */
function expectSpacing(spacing: Awaited<ReturnType<typeof boardSpacing>>) {
  expect(Math.abs(spacing.tile - spacing.tileHeight)).toBeLessThan(1);
  for (const gap of [spacing.across, spacing.down, ...spacing.padding]) {
    expect(gap).toBeGreaterThanOrEqual(0.1);
    expect(gap).toBeLessThanOrEqual(0.14);
  }
  for (const padding of spacing.padding) expect(Math.abs(padding - spacing.across)).toBeLessThan(0.01);
}

/** The board frame's position on the page. */
async function frameBox(page: Page) {
  return (await page.getByTestId('board-frame').boundingBox())!;
}

/** The toasts a phone shows: each one's kind, short text, whether it is one line, where it sits, and what it overlaps. */
async function phoneToasts(page: Page) {
  return page.evaluate(() => {
    const box = (selector: string) => document.querySelector(selector)!.getBoundingClientRect();
    const frame = box('[data-testid="board-frame"]');
    const plate = box('[data-testid="seat-A"]');
    const solid = [...document.querySelectorAll('[data-testid="board"] [data-cell], [data-testid="seat-A"], [data-testid="seat-B"]')];
    return [...document.querySelectorAll('[data-testid="toast"]')]
      .filter((toast) => getComputedStyle(toast).display !== 'none')
      .map((toast) => {
        const rect = toast.getBoundingClientRect();
        return {
          kind: toast.getAttribute('data-kind'),
          shown: getComputedStyle(toast, '::after').content.replace(/^"|"(\s*\/.*)?$/g, ''),
          full: toast.textContent,
          oneLine: rect.height <= 34 && toast.scrollWidth <= toast.clientWidth,
          // Tall enough to read: a toast squeezed into a thin strip is clipped, not shown.
          readable: rect.height >= 28 && toast.scrollHeight <= toast.clientHeight + 1,
          inGap: rect.top >= frame.bottom && rect.bottom <= plate.top,
          inside: rect.left >= 0 && rect.right <= window.innerWidth,
          overlaps: solid
            .filter((other) => {
              const o = other.getBoundingClientRect();
              return rect.left < o.right && o.left < rect.right && rect.top < o.bottom && o.top < rect.bottom;
            })
            .map((other) => other.getAttribute('data-cell') ?? other.getAttribute('data-testid')),
        };
      });
  });
}

/** On a phone: exactly one toast shows, of the given kind, in its short form on one line, in the gap under the board, over nothing. */
async function expectOnePhoneToast(page: Page, kind: 'refusal' | 'take', short: string | RegExp) {
  const shown = await phoneToasts(page);
  expect(shown, JSON.stringify(shown)).toHaveLength(1);
  const [toast] = shown as [Awaited<ReturnType<typeof phoneToasts>>[number]];
  expect(toast.kind).toBe(kind);
  expect(toast.shown).toMatch(short);
  expect(toast).toMatchObject({ oneLine: true, readable: true, inGap: true, inside: true, overlaps: [] });
  // The full text stays in the page for screen readers.
  expect(toast.full!.length).toBeGreaterThan(0);
}

/** With a take toast and a refusal shown, no toast covers a cell and the frame has not moved; the refusal clears on the next take. */
async function checkToastsBesideBoard(page: Page, viewport: 'wide' | 'phone', shoot?: () => Promise<void>) {
  await waitForHumanTurn(page);
  // No toast is up: wait for any from earlier to leave, then note where the frame sits.
  await expect(toasts(page)).toHaveCount(0, { timeout: TOAST_MS + FADE_MS + 1_000 });
  const before = await frameBox(page);

  // Your take, then the bot's take with its toast, then a refusal: both toasts are up together.
  await takeGlowing(page);
  await waitForHumanTurn(page);
  await expect(takeToast(page)).toHaveCount(1);
  const botCell = (await readBoard(page)).find((cell) => cell.last)!;
  if (viewport === 'phone') await expectOnePhoneToast(page, 'take', `Bot took ${botCell.terrain}–${botCell.symbol}`);
  const { illegal } = await legalFromPage(page);
  await cellAt(page, illegal[0]!.cell).click();
  await expect(refusalToast(page)).toBeVisible();
  await expect(takeToast(page)).toHaveCount(1);
  expect(await toastsOverCells(page), viewport).toEqual([]);
  expect(await frameBox(page), viewport).toEqual(before);
  await shoot?.();
  if (viewport === 'wide') {
    // Each toast lies wholly inside its fixed room, both shown.
    await expect(takeToast(page)).toBeVisible();
    const slot = (await page.getByTestId('toasts').boundingBox())!;
    for (const toast of await toasts(page).all()) {
      const box = (await toast.boundingBox())!;
      expect(box.y, viewport).toBeGreaterThanOrEqual(slot.y - 0.5);
      expect(box.y + box.height, viewport).toBeLessThanOrEqual(slot.y + slot.height + 0.5);
    }
  } else {
    // One at a time: the refusal outranks the take, in its short form naming both tiles.
    await expect(takeToast(page)).toBeHidden();
    await expectOnePhoneToast(page, 'refusal', new RegExp(`^${illegal[0]!.terrain}–${illegal[0]!.symbol} doesn't match ${botCell.terrain}–${botCell.symbol}$`));
    // A tap on a taken cell: its own short form replaces the refusal before it.
    await cellAt(page, botCell.cell).click();
    await expect(refusalToast(page)).toHaveText(/was already taken/);
    await expectOnePhoneToast(page, 'refusal', 'That tile is already taken');
    expect(await frameBox(page), viewport).toEqual(before);
  }

  // The refusal clears once the turn changes; the frame stays put as the toasts leave.
  const { legal } = await legalFromPage(page);
  await cellAt(page, legal[0]!).click();
  await expect(refusalToast(page)).toHaveCount(0, { timeout: 1_000 });
  expect(await frameBox(page), viewport).toEqual(before);
  await waitForHumanTurn(page);
  await expect(toasts(page)).toHaveCount(0, { timeout: TOAST_MS + FADE_MS + 1_000 });
  expect(await frameBox(page), viewport).toEqual(before);
}

test('[scenario:toasts-clear-board] the bot’s take toast and a refusal never overlap a board cell, wide and at 390 × 844, where one toast shows at a time in a one-line short form in the gap under the board over no cell or nameplate; the board never moves, and the refusal still clears when the turn changes', async ({ page }, testInfo) => {
  test.setTimeout(90_000);
  await startGame(page, { seed: HUMAN_STARTS, difficulty: 'Easy' });
  await checkToastsBesideBoard(page, 'wide', () => attachScreenshot(page, testInfo, 'toasts-clear-board'));

  // At 390 × 844, in a fresh game from the home screen.
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByTestId('menu-button').click();
  await page.getByRole('button', { name: /^Quit to title/ }).click();
  await playButton(page).click();
  await expect(match(page)).toHaveAttribute('data-takes', /^[01]$/);
  await checkToastsBesideBoard(page, 'phone');
  // Nothing on the phone layout scrolls to fit them.
  expect(await page.evaluate(() => document.documentElement.scrollHeight - window.innerHeight)).toBeLessThanOrEqual(0);
  await expect(glowing(page).first()).toBeVisible();

  // The opening's refusal, in a two-player game Player 1 opens: "Edge tiles only at the start", one line.
  await continueSaved(page, newGame({ seed: 5, starter: 'A' }), 'two-player');
  const before = await frameBox(page);
  await cellAt(page, 'B2').click();
  await expect(refusalToast(page)).toContainText('is not an edge tile');
  await expectOnePhoneToast(page, 'refusal', 'Edge tiles only at the start');
  expect(await frameBox(page)).toEqual(before);

  // On a short phone (375 × 667, an iPhone SE, or Safari with its toolbars showing) the gap under the
  // board still holds a readable one-line toast, over no cell or nameplate, with nothing scrolling.
  await page.setViewportSize({ width: 375, height: 667 });
  await continueSaved(page, newGame({ seed: 5, starter: 'A' }), 'two-player');
  const short = await frameBox(page);
  await cellAt(page, 'B2').click();
  await expect(refusalToast(page)).toContainText('is not an edge tile');
  await expectOnePhoneToast(page, 'refusal', 'Edge tiles only at the start');
  expect(await frameBox(page)).toEqual(short);
  expect(await page.evaluate(() => document.documentElement.scrollHeight - window.innerHeight)).toBeLessThanOrEqual(0);
  // Every tile stays at least 44 px there.
  for (const cell of await page.locator('[data-testid="board"] [data-cell]').all()) {
    const box = (await cell.boundingBox())!;
    expect(Math.min(box.width, box.height)).toBeGreaterThanOrEqual(44);
  }
});
