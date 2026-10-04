/// <reference lib="dom" />
// The DOM library types the callbacks that run in the page (page.evaluate).
import { expect, test, type Page } from '@playwright/test';
import { LINES, SQUARES } from '@okiya/game';
import {
  attachScreenshot,
  board,
  BOT_REPLY_MS,
  BOT_STARTS,
  cellAt,
  chooseDifficulty,
  chooseTwoPlayers,
  expectSeatsBeside,
  fixRandomness,
  frameStripe,
  gameSnapshot,
  glowing,
  HUMAN_STARTS,
  isEdge,
  legalFromPage,
  match,
  matchCard,
  matchTileFlight,
  openTitle,
  playToEnd,
  readBoard,
  readLastTile,
  refusalToast,
  seat,
  seatStatus,
  startGame,
  startTwoPlayerGame,
  takeCount,
  takeGlowing,
  takeToast,
  toasts,
  toMove,
  waitForHumanTurn,
} from './helpers';
import { FADE_MS, TOAST_MS } from '../../apps/web/src/toasts';

// Randomness is fixed per test through `fixRandomness`; tiles, tokens, seats and the Match card are
// read from the page, no test waits on an animation, and no test depends on which tile the bot takes.
const TITLE = 'Constraint';
const FIGHTER_WORDS = /\b(fighters?|traps?|recharges?|rosters?|objectives?|abilit(y|ies)|setup)\b/i;
const RESULT = /^(You win|The bot wins|Player [12] wins) by (a line|a square|blockade)$|^Draw: the board is full$/;

/** No playtest helper and nothing of the fighter game is on the page. */
async function expectNoLeftovers(page: Page) {
  const text = await page.locator('body').innerText();
  expect(text).not.toMatch(/\bseed\b|preset|scenario|spec-v0/i);
  expect(text).not.toMatch(FIGHTER_WORDS);
  await expect(page.locator('[data-testid="setup-board"], [data-testid="own-tray"], [data-testid="bot-tray"], [data-testid="pool"], [data-testid="roster"], [data-fighter]')).toHaveCount(0);
}

/** Opens the game menu with its button. */
async function openMenu(page: Page) {
  await page.getByTestId('menu-button').click();
  await expect(page.getByRole('dialog', { name: 'Menu' })).toBeVisible();
}

/** The score of the sitting as the page shows it. */
async function readScore(page: Page) {
  const line = page.getByTestId('sitting-score');
  const [a, b, draws] = await Promise.all(['data-a', 'data-b', 'data-draws'].map(async (name) => Number(await line.getAttribute(name))));
  return { a: a!, b: b!, draws: draws!, text: (await line.innerText()).replace(/\s+/g, ' ').trim() };
}

/** The results by difficulty from the title screen. */
async function readResults(page: Page) {
  return page
    .getByTestId('results')
    .locator('tr[data-difficulty]')
    .evaluateAll((rows) => rows.map((row) => ['data-difficulty', 'data-wins', 'data-losses', 'data-draws'].map((name) => row.getAttribute(name)).join(':')));
}

const tile = (cell: { terrain: string; symbol: string }) => `${cell.terrain}–${cell.symbol}`;

test('[scenario:title-screen] the title screen offers New game, Continue for a saved game, How to play, results by difficulty and a settings menu', async ({ page }, testInfo) => {
  // The app reads no URL parameters: playtest parameters change nothing.
  await fixRandomness(page, HUMAN_STARTS);
  await page.goto('/?seed=7&preset=spec-v0.2&scenario=paper-test-01&difficulty=hard');
  await expect(page).toHaveTitle(TITLE);
  const title = page.getByTestId('title-screen');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(TITLE);
  await expect(page.getByTestId('logo')).toBeVisible();

  // How to Play opens by itself on the very first visit.
  await expect(page.getByTestId('how-to-play')).toBeVisible();
  await page.getByRole('button', { name: 'Close How to play' }).click();
  await expect(page.getByTestId('how-to-play')).toHaveCount(0);

  await expect(title.getByRole('button', { name: /^New game/ })).toBeVisible();
  await expect(title.getByRole('button', { name: 'How to play' })).toBeVisible();
  await expect(page.getByTestId('continue')).toHaveCount(0);
  const results = page.getByTestId('results');
  for (const difficulty of ['easy', 'normal', 'hard']) {
    const row = results.locator(`tr[data-difficulty="${difficulty}"]`);
    await expect(row).toHaveAttribute('data-wins', '0');
    await expect(row).toHaveAttribute('data-losses', '0');
    await expect(row).toHaveAttribute('data-draws', '0');
  }
  for (const label of ['Easy', 'Normal', 'Hard', 'Wins', 'Losses', 'Draws']) await expect(results).toContainText(label);

  // The settings live in a menu, not on the page.
  await expect(page.getByRole('switch')).toHaveCount(0);
  const settings = title.getByRole('button', { name: 'Settings' });
  await settings.click();
  const dialog = page.getByRole('dialog', { name: 'Settings' });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole('switch', { name: 'Highlight legal tiles' })).toHaveAttribute('aria-checked', 'true');
  await expect(dialog.getByRole('switch', { name: 'Sound' })).toHaveAttribute('aria-checked', 'true');
  await page.keyboard.press('Escape');
  await expect(dialog).toHaveCount(0);
  await expect(settings).toBeFocused();
  await expectNoLeftovers(page);

  // A started game is saved: quitting to the title offers Continue.
  await chooseDifficulty(page, 'Normal');
  await expectNoLeftovers(page);
  await openMenu(page);
  await page.getByRole('button', { name: /^Quit to title/ }).click();
  const resume = page.getByTestId('continue');
  await expect(resume).toBeVisible();
  await expect(resume).toContainText('Normal bot, 0 tiles taken');
  await expect(title.getByRole('button', { name: /^New game/ })).toContainText('replaces the saved game');
  await attachScreenshot(page, testInfo, 'title-screen');
});

test('[scenario:mode-choice] New game offers Versus bot and Two players; Versus bot asks for a difficulty, Two players starts at once, and Back returns', async ({ page }, testInfo) => {
  await openTitle(page);
  await page.getByRole('button', { name: /^New game/ }).click();
  const modes = page.getByTestId('mode-screen').locator('button[data-mode]');
  await expect(modes).toHaveCount(2);
  expect(await modes.evaluateAll((buttons) => buttons.map((button) => button.getAttribute('data-mode')))).toEqual(['bot', 'two-player']);
  await expect(page.getByRole('button', { name: /^Versus bot/ })).toBeVisible();
  await expect(page.getByRole('button', { name: /^Two players/ })).toBeVisible();
  await expectNoLeftovers(page);
  await attachScreenshot(page, testInfo, 'mode-choice');

  // Back returns to the title screen.
  await page.getByRole('button', { name: 'Back' }).click();
  await expect(page.getByTestId('title-screen')).toBeVisible();

  // Versus bot asks for Easy, Normal or Hard; Back from there returns to the mode choice.
  await page.getByRole('button', { name: /^New game/ }).click();
  await page.getByRole('button', { name: /^Versus bot/ }).click();
  const difficulties = page.getByTestId('difficulty-screen').locator('button[data-difficulty]');
  expect(await difficulties.evaluateAll((buttons) => buttons.map((button) => button.getAttribute('data-difficulty')))).toEqual(['easy', 'normal', 'hard']);
  await page.getByRole('button', { name: 'Back' }).click();
  await expect(page.getByTestId('mode-screen')).toBeVisible();

  // Versus bot, then a difficulty, then the board.
  await page.getByRole('button', { name: /^Versus bot/ }).click();
  await page.getByRole('button', { name: /^Easy\b/ }).click();
  await expect(board(page)).toBeVisible();
  await expect(match(page)).toHaveAttribute('data-mode', 'bot');
  await openMenu(page);
  await page.getByRole('button', { name: /^Quit to title/ }).click();

  // Two players goes straight to the board, with seats for Player 1 and Player 2 and no bot.
  await page.getByRole('button', { name: /^New game/ }).click();
  await page.getByRole('button', { name: /^Two players/ }).click();
  await expect(page.getByTestId('difficulty-screen')).toHaveCount(0);
  await expect(board(page)).toBeVisible();
  await expect(match(page)).toHaveAttribute('data-mode', 'two-player');
  await expect(page.getByTestId('seat-A-name')).toHaveText('Player 1');
  await expect(page.getByTestId('seat-B-name')).toHaveText('Player 2');
  await expect(page.locator('main')).not.toContainText(/\bbot\b/i);
});

test('[scenario:new-game] Versus bot at a difficulty shows the board at once with all 16 tiles, seats for You and the bot, and the lit seat says who starts', async ({ page, browser }, testInfo) => {
  await openTitle(page, HUMAN_STARTS);
  await chooseDifficulty(page, 'Normal');

  // The board at once: 16 tiles, one of each terrain and symbol pair, each drawn with its scene and emblem, and no token.
  const cells = await readBoard(page);
  expect(cells).toHaveLength(16);
  expect(new Set(cells.map(tile)).size).toBe(16);
  expect(cells.every((cell) => cell.owner === null)).toBe(true);
  await expect(board(page).locator('svg.scene')).toHaveCount(16);
  await expect(board(page).locator('.tile-symbol svg.emblem-svg')).toHaveCount(16);
  await expect(board(page).getByTestId('token')).toHaveCount(0);
  await expectNoLeftovers(page);

  // The seats: You and the bot at that difficulty; the lit seat says the player starts.
  await expect(page.getByTestId('seat-A-name')).toHaveText('You');
  await expect(page.getByTestId('seat-B-name')).toHaveText('Bot · Normal');
  await expect(match(page)).toHaveAttribute('data-starter', 'A');
  await expect(seat(page, 'A')).toHaveAttribute('data-lit', 'true');
  await expect(seatStatus(page, 'A')).toHaveText('Your move');
  await expect(seat(page, 'B')).toHaveAttribute('data-lit', 'false');
  await expect(page.getByTestId('announcer')).toHaveText('You start. Your move.');
  await expect(matchCard(page)).toContainText('Any edge tile');
  for (const player of ['A', 'B'] as const) {
    await expect(seat(page, player)).toHaveAttribute('data-tokens-left', '8');
    await expect(seat(page, player)).toHaveAttribute('data-score', '0');
  }
  await attachScreenshot(page, testInfo, 'new-game');

  // Under other randomness the bot starts, its seat says so, and it opens with an edge tile.
  const context = await browser.newContext({ baseURL: testInfo.project.use.baseURL!, reducedMotion: 'reduce' });
  const other = await context.newPage();
  await openTitle(other, BOT_STARTS);
  await chooseDifficulty(other, 'Easy');
  await expect(other.getByTestId('seat-B-name')).toHaveText('Bot · Easy');
  await expect(match(other)).toHaveAttribute('data-starter', 'B');
  await expect(other.getByTestId('announcer')).toHaveText('The bot starts. Bot is thinking.');
  await waitForHumanTurn(other);
  const opened = (await readBoard(other)).filter((cell) => cell.owner === 'B');
  expect(opened).toHaveLength(1);
  expect(isEdge(opened[0]!.cell)).toBe(true);
  await expect(seatStatus(other, 'A')).toHaveText('Your move');
  await context.close();
});

test('[scenario:match-screen] the game is the board, a seat for each player, the Match card and a top bar holding only the menu button, and no panel', async ({ page }, testInfo) => {
  await startGame(page);
  await takeGlowing(page);
  await waitForHumanTurn(page);

  // Each seat: an avatar, a name, a token mark, the tokens left out of 8 and the score.
  for (const [player, name, mark] of [
    ['A', 'You', 'ring'],
    ['B', 'Bot · Easy', 'diamond'],
  ] as const) {
    const view = seat(page, player);
    await expect(view.locator(`svg[data-testid="avatar-${player}"]`)).toBeVisible();
    await expect(page.getByTestId(`seat-${player}-name`)).toHaveText(name);
    await expect(page.getByTestId(`seat-${player}-tokens`).locator(`svg.token-mark[data-shape="${mark}"]`)).toBeVisible();
    await expect(page.getByTestId(`seat-${player}-tokens`)).toContainText('7/8');
    await expect(page.getByTestId(`seat-${player}-tokens`).getByLabel('7 of 8 tokens left')).toBeVisible();
    await expect(page.getByTestId(`seat-${player}-score`)).toContainText('Wins0');
    await expect(view.locator('button, a, [tabindex]')).toHaveCount(0);
  }
  await expect(page.getByTestId('sitting-score')).toContainText('You 0 – 0 Bot');
  // On a wide screen You sit left of the board and the bot right of it.
  await expectSeatsBeside(page);

  // The Match card: the last tile's scene, emblem and both names.
  const last = (await readLastTile(page))!;
  const card = matchCard(page);
  await expect(card).toHaveAttribute('aria-label', `Tile to match: ${tile(last)}`);
  await expect(card.locator(`.tile-art[data-terrain="${last.terrain}"][data-symbol="${last.symbol}"] svg.scene`)).toBeVisible();
  await expect(card.locator('.tile-art svg.emblem-svg')).toBeVisible();
  await expect(page.getByTestId('match-card-terrain')).toHaveText(last.terrain);
  await expect(page.getByTestId('match-card-symbol')).toHaveText(last.symbol);

  // The top bar holds only the menu button (with the Match card on a phone).
  const bar = page.getByTestId('top-bar');
  await expect(bar.locator('button')).toHaveCount(1);
  await expect(bar.getByRole('button', { name: 'Menu' })).toBeVisible();

  // The board, with both tokens on it.
  await expect(board(page).locator('[data-cell]')).toHaveCount(16);
  await expect(board(page).locator('[data-owner="A"] [data-testid="token"]')).toHaveCount(1);
  await expect(board(page).locator('[data-owner="B"] [data-testid="token"]')).toHaveCount(1);

  // Nothing else: no log, last actions, status, legend, tray or settings panel, and no old top-bar turn text.
  for (const testId of ['log', 'resolution', 'status', 'legend', 'settings', 'menu-settings', 'own-tray', 'bot-tray', 'actions', 'chooser', 'goal-chip', 'recharges', 'turn', 'token-counts', 'last-tile']) {
    await expect(page.getByTestId(testId), testId).toHaveCount(0);
  }
  for (const name of [/^Log$/, /^Last actions$/, /^Status$/, /tray/i, /^Settings$/, /legend/i]) {
    await expect(page.getByRole('heading', { name }), String(name)).toHaveCount(0);
  }
  await expect(page.getByRole('switch')).toHaveCount(0);
  await expect(page.locator('main button')).toHaveCount(17); // the menu button and the 16 cells
  const text = await page.locator('main').innerText();
  expect(text).not.toMatch(/Turn \d|\bLog\b|Last actions/);
  await expectNoLeftovers(page);
  await attachScreenshot(page, testInfo, 'match-screen');
});

test('[scenario:seats-turn] in a two-player game the lit seat, its label, the frame, the glow and the announcement follow the player to move', async ({ page }, testInfo) => {
  await startTwoPlayerGame(page, { seed: HUMAN_STARTS });
  const announcer = page.getByTestId('announcer');

  /** The lit seat's colour, the glowing tiles' ring colour, and the frame's active side. */
  async function colours(player: 'A' | 'B') {
    return page.evaluate((who) => {
      const seatElement = document.querySelector(`[data-testid="seat-${who}"]`)!;
      const glow = document.querySelector('[data-testid="board"] [data-glow="true"]');
      return {
        seat: getComputedStyle(seatElement).borderTopColor,
        seatBackground: getComputedStyle(seatElement).backgroundColor,
        glow: glow ? getComputedStyle(glow).boxShadow : '',
        frame: getComputedStyle(document.querySelector('[data-testid="board-frame"]')!).boxShadow,
      };
    }, player);
  }

  async function expectTurn(player: 'A' | 'B') {
    const other = player === 'A' ? 'B' : 'A';
    const number = player === 'A' ? 1 : 2;
    await expect(seat(page, player)).toHaveAttribute('data-lit', 'true');
    await expect(seat(page, player)).toHaveAttribute('data-expression', 'to-move');
    await expect(seatStatus(page, player)).toHaveText(`Player ${number}'s move`);
    await expect(seat(page, other)).toHaveAttribute('data-lit', 'false');
    await expect(seat(page, other)).toHaveAttribute('data-expression', 'idle');
    await expect(seatStatus(page, other)).toHaveText('');
    await expect(page.getByTestId('board-frame')).toHaveAttribute('data-active', player);
    await expect(board(page)).toHaveAttribute('data-glow-player', player);
    const lit = await colours(player);
    const dim = await colours(other);
    // The glowing tiles and the frame's side take the lit seat's colour; the dimmed seat looks different.
    expect(lit.glow).toContain(lit.seat);
    expect(lit.frame).toContain(lit.seat);
    // The stripe sits on the mover's side of the frame: left for Player 1, right for Player 2.
    expect(await frameStripe(page)).toEqual({ side: player === 'A' ? 'left' : 'right', color: lit.seat });
    expect(dim.seat).not.toBe(lit.seat);
    expect(dim.seatBackground).not.toBe(lit.seatBackground);
  }

  await expectTurn('A');
  await expectSeatsBeside(page);
  await expect(announcer).toHaveText("Player 1 starts. Player 1's move.");
  await expect(announcer).toHaveAttribute('aria-live', 'polite');
  const { legal } = await legalFromPage(page);
  expect((await readBoard(page)).filter((cell) => cell.glow).map((cell) => cell.cell)).toEqual(legal);

  // Player 1 takes: the turn, the label and the announcement switch to Player 2.
  const first = await takeGlowing(page);
  const firstTile = tile((await readBoard(page)).find((cell) => cell.cell === first)!);
  await expectTurn('B');
  await expect(announcer).toHaveText(`Player 1 took ${first}, ${firstTile}. Player 2's move.`);
  expect((await readBoard(page)).filter((cell) => cell.glow).map((cell) => cell.cell)).toEqual((await legalFromPage(page)).legal);
  await expect(toasts(page)).toHaveCount(0);
  await attachScreenshot(page, testInfo, 'seats-turn');

  // Player 2 takes: back to Player 1, with no take toast in a two-player game.
  const second = await takeGlowing(page);
  await expect(cellAt(page, second)).toHaveAttribute('data-owner', 'B');
  await expect(cellAt(page, second)).toHaveAttribute('aria-label', `${second}, Player 2's token, last take`);
  await expectTurn('A');
  await expect(announcer).toContainText(`Player 2 took ${second}`);
  await expect(announcer).toContainText("Player 1's move.");
  await expect(takeToast(page)).toHaveCount(0);
  await expect(seat(page, 'A')).toHaveAttribute('data-tokens-left', '7');
  await expect(seat(page, 'B')).toHaveAttribute('data-tokens-left', '7');

  // With motion on (PRD U8): the seats change with a transition, and each take's tile flies from its cell
  // into the Match card without taking taps, so the next player's tap lands on the board at once.
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  for (const player of ['A', 'B'] as const) expect(await seat(page, player).evaluate((element) => getComputedStyle(element).transitionDuration)).not.toBe('0s');
  const target = (await readBoard(page)).find((cell) => cell.glow)!;
  const centre = (await cellAt(page, target.cell).boundingBox())!;
  await page.mouse.click(centre.x + centre.width / 2, centre.y + centre.height / 2);
  const flight = await matchTileFlight(page);
  expect(flight, 'a glowing tile for Player 2 after the take').not.toBeNull();
  expect(flight!.arriving).toBe(true);
  expect(flight!.animation).toBe('tile-arrive');
  expect(flight!.fromX).toMatch(/px$/);
  expect(flight!.takesTaps).toBe(false);
  await expect(cellAt(page, target.cell)).toHaveAttribute('data-owner', 'A');
  // Player 2 taps a glowing tile at once, while Player 1's tile may still be in flight; the tap takes it.
  await page.mouse.click(flight!.next.x, flight!.next.y);
  await expect(cellAt(page, flight!.next.cell)).toHaveAttribute('data-owner', 'B');
});

test('[scenario:opening-take] at the opening only the 12 edge tiles glow, an inner tile is refused, and an edge take places a token and fills the Match card', async ({ page }, testInfo) => {
  await startGame(page, { seed: HUMAN_STARTS });
  await expect(match(page)).toHaveAttribute('data-starter', 'A');
  await expect(seatStatus(page, 'A')).toHaveText('Your move');
  await expect(matchCard(page)).toHaveAttribute('data-opening', 'true');
  await expect(page.getByTestId('match-card-opening')).toHaveText('Any edge tile');

  const cells = await readBoard(page);
  const lit = cells.filter((cell) => cell.glow).map((cell) => cell.cell);
  expect(lit).toHaveLength(12);
  expect(lit).toEqual(cells.filter((cell) => isEdge(cell.cell)).map((cell) => cell.cell));
  for (const cell of cells.filter((candidate) => candidate.glow)) expect(cell.label).toBe(`${cell.cell}, ${tile(cell)}, legal take`);
  // The glow draws no mark over the tile art.
  await expect(board(page).locator('.glow-dot')).toHaveCount(0);
  expect(await glowing(page).first().evaluate((element) => [...element.children].map((child) => child.getAttribute('class')))).toEqual(['scene', 'tile-symbol', 'tile-label']);

  // An inner tile is refused with its reason, and nothing is taken.
  const inner = cells.find((cell) => cell.cell === 'B2')!;
  await cellAt(page, 'B2').click();
  await expect(refusalToast(page)).toHaveText(`${tile(inner)} is not an edge tile; the first take must come from the edge.`);
  expect(await takeCount(page)).toBe(0);
  await expect(cellAt(page, 'B2')).not.toHaveAttribute('data-owner', /.+/);

  // An edge tile: the player's token takes its place, it is marked as the last take and shown in the Match card.
  const edge = cells.find((cell) => cell.cell === lit[lit.length - 1])!;
  await cellAt(page, edge.cell).click();
  await expect(cellAt(page, edge.cell)).toHaveAttribute('data-owner', 'A');
  await expect(cellAt(page, edge.cell).getByTestId('token')).toHaveAttribute('data-owner', 'A');
  await expect(cellAt(page, edge.cell).locator('svg.scene')).toHaveCount(0);
  await expect(matchCard(page)).toHaveAttribute('data-terrain', edge.terrain);
  await expect(matchCard(page)).toHaveAttribute('data-symbol', edge.symbol);
  await expect(page.getByTestId('match-card-terrain')).toHaveText(edge.terrain);
  await expect(page.getByTestId('match-card-symbol')).toHaveText(edge.symbol);
  await expect(seat(page, 'A')).toHaveAttribute('data-tokens-left', '7');
  await attachScreenshot(page, testInfo, 'opening-take');
});

test('[scenario:legal-turn] after the bot’s take its cell is marked and toasted, exactly the matching tiles glow, a refusal names both tiles and clears when the turn changes', async ({ page }, testInfo) => {
  await startGame(page);
  await takeGlowing(page);
  await waitForHumanTurn(page);
  await expect(seatStatus(page, 'A')).toHaveText('Your move');
  expect(await takeCount(page)).toBe(2);

  // The bot's take is marked as the last one, named in a toast, and its tile is in the Match card.
  const cells = await readBoard(page);
  const marked = cells.filter((cell) => cell.last);
  expect(marked).toHaveLength(1);
  const botCell = marked[0]!;
  expect(botCell.owner).toBe('B');
  expect(botCell.label).toBe(`${botCell.cell}, bot's token, last take`);
  expect(await readLastTile(page)).toEqual({ terrain: botCell.terrain, symbol: botCell.symbol });
  await expect(takeToast(page)).toHaveText(`Bot took ${botCell.cell}, ${tile(botCell)}`);
  await expect(page.getByTestId('announcer')).toHaveText(`Bot took ${botCell.cell}, ${tile(botCell)}. Your move.`);

  // Exactly the free tiles sharing its terrain or symbol glow, in Player 1's colour.
  const { legal, illegal } = await legalFromPage(page);
  expect(legal.length).toBeGreaterThan(0);
  expect(cells.filter((cell) => cell.glow).map((cell) => cell.cell)).toEqual(legal);
  await expect(board(page)).toHaveAttribute('data-glow-player', 'A');

  // A tile that matches neither is refused with a reason naming both tiles; the turn stays.
  const wrong = illegal[0]!;
  await cellAt(page, wrong.cell).click();
  await expect(refusalToast(page)).toHaveText(`${tile(wrong)} matches neither ${botCell.terrain} nor ${botCell.symbol}`);
  expect(await takeCount(page)).toBe(2);
  await expect(seatStatus(page, 'A')).toHaveText('Your move');
  await attachScreenshot(page, testInfo, 'legal-turn');

  // A matching take hands the turn to the bot, and the refusal clears at once: well before a toast leaves on
  // its own (TOAST_MS), so its own expiry cannot explain the disappearance. A fresh refusal replaces the
  // shown one, so its life starts just before the take.
  await cellAt(page, wrong.cell).click();
  await expect(refusalToast(page)).toHaveCount(1);
  const refusedAt = Date.now();
  await cellAt(page, legal[0]!).click();
  await expect(cellAt(page, legal[0]!)).toHaveAttribute('data-owner', 'A');
  await expect(refusalToast(page)).toHaveCount(0, { timeout: 1_000 });
  expect(Date.now() - refusedAt).toBeLessThan(TOAST_MS - FADE_MS);
  await expect(seatStatus(page, 'B')).toHaveText('Bot is thinking');
  await expect(match(page)).toHaveAttribute('data-to-move', 'B');
  await waitForHumanTurn(page);
  expect(await takeCount(page)).toBe(4);
  await expect(refusalToast(page)).toHaveCount(0);

  // With motion on (PRD U8), the bot's tile flies into the Match card without taking taps: a tap right
  // after the bot's take lands on the board.
  if ((await page.getByTestId('end-screen').count()) > 0) return;
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await takeGlowing(page);
  const flight = await page.waitForFunction(
    () => {
      const screen = document.querySelector('[data-testid="match-screen"]');
      const tile = document.querySelector('[data-testid="match-card"] .match-tile.arriving');
      if (screen?.getAttribute('data-accepts-takes') !== 'true' || !tile) return null;
      const box = tile.getBoundingClientRect();
      const hit = document.elementFromPoint(box.left + box.width / 2, box.top + box.height / 2);
      return { takesTaps: hit !== null && tile.contains(hit), pointerEvents: getComputedStyle(tile).pointerEvents };
    },
    null,
    { timeout: BOT_REPLY_MS },
  );
  expect(await flight.jsonValue()).toEqual({ takesTaps: false, pointerEvents: 'none' });
  const next = (await readBoard(page)).find((cell) => cell.glow)!;
  const centre = (await cellAt(page, next.cell).boundingBox())!;
  await page.mouse.click(centre.x + centre.width / 2, centre.y + centre.height / 2);
  await expect(cellAt(page, next.cell)).toHaveAttribute('data-owner', 'A');
});

test('[scenario:highlight-toggle] with highlights off nothing glows, a legal take works, an illegal one is refused, and the setting survives a reload', async ({ page }, testInfo) => {
  await startGame(page);
  await openMenu(page);
  const highlights = page.getByRole('switch', { name: 'Highlight legal tiles' });
  await expect(highlights).toHaveAttribute('aria-checked', 'true');
  await highlights.click();
  await expect(highlights).toHaveAttribute('aria-checked', 'false');
  await page.getByRole('button', { name: 'Resume' }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);

  const lit = page.locator('[data-glow="true"], .glow, [data-glow-player]');
  await expect(lit).toHaveCount(0);
  // Whose move it is still shows on the seats and the frame.
  await expect(seatStatus(page, 'A')).toHaveText('Your move');
  await expect(page.getByTestId('board-frame')).toHaveAttribute('data-active', 'A');

  // The opening: an inner tile is refused with its reason, an edge tile is taken.
  const opening = await readBoard(page);
  await cellAt(page, 'C3').click();
  await expect(refusalToast(page)).toHaveText(`${tile(opening.find((cell) => cell.cell === 'C3')!)} is not an edge tile; the first take must come from the edge.`);
  expect(await takeCount(page)).toBe(0);
  await cellAt(page, 'A1').click();
  await expect(cellAt(page, 'A1')).toHaveAttribute('data-owner', 'A');
  await waitForHumanTurn(page);

  // After the bot's take: still nothing glows, a non-matching tile is refused, a matching one is taken.
  await expect(lit).toHaveCount(0);
  const last = (await readLastTile(page))!;
  const { legal, illegal } = await legalFromPage(page);
  await cellAt(page, illegal[0]!.cell).click();
  await expect(refusalToast(page)).toHaveText(`${tile(illegal[0]!)} matches neither ${last.terrain} nor ${last.symbol}`);
  expect(await takeCount(page)).toBe(2);
  await attachScreenshot(page, testInfo, 'highlight-toggle');
  await cellAt(page, legal[0]!).click();
  await expect(cellAt(page, legal[0]!)).toHaveAttribute('data-owner', 'A');
  expect(await takeCount(page)).toBe(3);
  await waitForHumanTurn(page);

  // The setting is still off after a reload, on the title screen and in the restored game.
  await page.reload();
  await page.getByRole('button', { name: 'Settings' }).click();
  await expect(page.getByRole('switch', { name: 'Highlight legal tiles' })).toHaveAttribute('aria-checked', 'false');
  await page.keyboard.press('Escape');
  await page.getByTestId('continue').click();
  await expect(board(page)).toBeVisible();
  await expect(lit).toHaveCount(0);
  await openMenu(page);
  await expect(page.getByRole('switch', { name: 'Highlight legal tiles' })).toHaveAttribute('aria-checked', 'false');
});

test('[scenario:how-to-play] How to Play opens from the title and the game menu, shows its pages with diagrams drawn with the tile art, closes with Escape or its button, and returns focus', async ({ page }, testInfo) => {
  await openTitle(page);
  const dialog = page.getByRole('dialog', { name: 'How to play' });
  const opener = page.getByTestId('title-screen').getByRole('button', { name: 'How to play' });
  await opener.click();
  await expect(dialog).toBeVisible();
  await expect(page.getByRole('button', { name: 'Close How to play' })).toBeFocused();

  // The pages in order, each with its diagrams drawn with the real tile art.
  const page1 = dialog.locator('[data-section="taking"]');
  await expect(page1).toContainText('same terrain or the same symbol');
  await expect(dialog.getByTestId('matching-example')).toContainText('✓ matches (same terrain)');
  await expect(dialog.getByTestId('matching-example')).toContainText('✗ no match');
  await expect(dialog.getByTestId('matching-example').locator('.tile-art svg.scene')).toHaveCount(4);
  await expect(dialog.getByTestId('howto-back')).toBeDisabled();
  const pages: [string, string, string[]][] = [
    ['taking', 'Match card', ['matching']],
    ['opening', 'edge', ['opening']],
    ['shapes', 'diagonal', ['line', 'square']],
    ['blockade', 'cannot take', ['blockade']],
    ['draw', 'draw', ['draw']],
  ];
  for (const [index, [section, words, diagrams]] of pages.entries()) {
    if (index > 0) await dialog.getByTestId('howto-next').click();
    const part = dialog.locator(`[data-section="${section}"]`);
    await expect(part).toBeVisible();
    await expect(part).toContainText(words);
    await expect(dialog.getByTestId('howto-page')).toHaveText(`Page ${index + 1} of 5`);
    for (const id of diagrams) {
      const diagram = dialog.getByTestId(`diagram-${id}`);
      await expect(diagram.locator('.mini-cell')).toHaveCount(16);
      const free = await diagram.locator('.mini-cell:not([data-token])').count();
      await expect(diagram.locator('.mini-cell .tile-art svg.scene')).toHaveCount(free);
      await expect(diagram.locator('.mini-cell .tile-art svg.emblem-svg')).toHaveCount(free);
    }
  }
  await expect(dialog.getByTestId('diagram-draw').locator('[data-token]')).toHaveCount(16);
  await expect(dialog.getByTestId('howto-done')).toBeVisible();
  await dialog.getByTestId('howto-back').click();
  await expect(dialog.locator('[data-section="blockade"]')).toBeVisible();
  await expect(dialog.getByTestId('diagram-blockade').locator('[data-mark="last"]')).toHaveCount(1);
  await expect(dialog.getByTestId('diagram-blockade').locator('[data-mark="dead"]')).toHaveCount(3);
  await expect(dialog).not.toContainText(/fighter|trap|recharge|roster|objective|\bbot\b/i);

  // Tab never leaves the dialog.
  for (let i = 0; i < 6; i += 1) {
    await page.keyboard.press('Tab');
    expect(await page.evaluate(() => !!document.activeElement?.closest('[role="dialog"]'))).toBe(true);
  }
  await page.keyboard.press('Shift+Tab');
  expect(await page.evaluate(() => !!document.activeElement?.closest('[role="dialog"]'))).toBe(true);

  // Escape closes it, and focus returns to the button that opened it.
  await page.keyboard.press('Escape');
  await expect(dialog).toHaveCount(0);
  await expect(opener).toBeFocused();

  // From the game menu, closed with its close button; focus returns to the menu's button.
  await chooseDifficulty(page, 'Easy');
  await openMenu(page);
  const menuOpener = page.getByTestId('menu-how-to-play');
  await menuOpener.click();
  await expect(dialog).toBeVisible();
  await expect(dialog.locator('[data-section="taking"]')).toBeVisible();
  await attachScreenshot(page, testInfo, 'how-to-play');
  await page.getByRole('button', { name: 'Close How to play' }).click();
  await expect(dialog).toHaveCount(0);
  await expect(menuOpener).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(page.getByTestId('menu-button')).toBeFocused();
});

test('[scenario:resume-match] after a reload, Continue restores the same board, tokens, Match card, turn, mode and score of the sitting', async ({ page }, testInfo) => {
  test.setTimeout(90_000);
  await startGame(page, { difficulty: 'Normal' });
  for (let i = 0; i < 3; i += 1) {
    await waitForHumanTurn(page);
    await takeGlowing(page);
  }
  await waitForHumanTurn(page);
  await expect(page.getByTestId('end-screen')).toHaveCount(0);
  expect(await takeCount(page)).toBe(6);
  const before = await gameSnapshot(page);
  expect(before.tokens).toBe(6);
  expect(before.mode).toBe('bot');
  expect(before.seats.map((view) => view.tokensLeft)).toEqual(['5', '5']);
  expect(before.score).toContain('You 0 – 0 Bot');

  await page.reload();
  const resume = page.getByTestId('continue');
  await expect(resume).toBeVisible();
  await expect(resume).toContainText('Normal bot, 6 tiles taken');
  await resume.click();
  await expect(board(page)).toBeVisible();
  expect(await gameSnapshot(page)).toEqual(before);
  await expect(seatStatus(page, 'A')).toHaveText('Your move');
  await expect(page.getByTestId('seat-B-name')).toHaveText('Bot · Normal');
  // A resumed game starts quiet: no toast from earlier takes.
  await expect(toasts(page)).toHaveCount(0);

  // The restored game goes on: one more take and the bot's reply.
  await takeGlowing(page);
  await waitForHumanTurn(page);
  expect(await takeCount(page)).toBeGreaterThanOrEqual(7);
  await attachScreenshot(page, testInfo, 'resume-match');

  // A two-player game restores as one, with its seats.
  await page.getByTestId('menu-button').click();
  await page.getByRole('button', { name: /^Quit to title/ }).click();
  await chooseTwoPlayers(page);
  await takeGlowing(page);
  await takeGlowing(page);
  const pair = await gameSnapshot(page);
  await page.reload();
  await expect(page.getByTestId('continue')).toContainText('Two players, 2 tiles taken');
  await page.getByTestId('continue').click();
  expect(await gameSnapshot(page)).toEqual(pair);
  expect(pair.mode).toBe('two-player');
});

test('[scenario:full-match] glowing takes play a bot game to its end screen, which names the result once, marks the winning shape, shows the faces and is counted', async ({ page }, testInfo) => {
  test.setTimeout(240_000);
  await openTitle(page);
  const easy = page.getByTestId('results').locator('tr[data-difficulty="easy"]');
  const total = async () =>
    (await Promise.all(['data-wins', 'data-losses', 'data-draws'].map((name) => easy.getAttribute(name)))).reduce((sum, value) => sum + Number(value), 0);
  const before = await total();
  await chooseDifficulty(page, 'Easy');
  await playToEnd(page, 20);
  // When the bot's take ends the game, that take is still toasted like any other (but never the result).
  const lastTake = (await readBoard(page)).find((cell) => cell.last)!;
  if (lastTake.owner === 'B') await expect(takeToast(page)).toHaveText(`Bot took ${lastTake.cell}, ${tile(lastTake)}`);

  // The end screen names the result and how it happened, once: no toast and no seat repeats it.
  const end = page.getByTestId('end-screen');
  const by = (await end.getAttribute('data-by'))!;
  expect(['line', 'square', 'blockade', 'full-board']).toContain(by);
  const result = (await page.getByTestId('result').textContent())!;
  const expected = { line: / by a line$/, square: / by a square$/, blockade: / by blockade$/, 'full-board': /^Draw: the board is full$/ }[by]!;
  expect(result).toMatch(/^(You win|The bot wins|Draw)/);
  expect(result).toMatch(expected);
  await expect(page.locator('[data-testid="toast"][data-kind="end"]')).toHaveCount(0);
  await expect(page.getByText(result, { exact: true })).toHaveCount(1);
  const detail = (await page.getByTestId('result-detail').textContent())!;

  // The winning shape's four cells are marked on the board with a stroke across them, and hold the winner's tokens.
  const cells = await readBoard(page);
  const winning = cells.filter((cell) => cell.winning);
  const winner = (await end.getAttribute('data-winner'))!;
  if (by === 'line' || by === 'square') {
    expect(winning).toHaveLength(4);
    for (const cell of winning) expect(cell.owner).toBe(winner);
    const ids = winning.map((cell) => cell.cell).sort().join();
    expect((by === 'line' ? LINES : SQUARES).some((shape) => [...shape].sort().join() === ids)).toBe(true);
    for (const cell of winning) expect(detail).toContain(cell.cell);
    await expect(page.getByTestId('win-stroke')).toHaveAttribute('data-by', by);
  } else {
    expect(winning).toHaveLength(0);
    await expect(page.getByTestId('win-stroke')).toHaveCount(0);
    if (by === 'full-board') expect(cells.every((cell) => cell.owner !== null)).toBe(true);
  }

  // The seats show the result on the avatars: won and lost, or both idle after a draw; neither is lit.
  const faces = winner === 'A' ? ['won', 'lost'] : winner === 'B' ? ['lost', 'won'] : ['idle', 'idle'];
  for (const [index, player] of (['A', 'B'] as const).entries()) {
    await expect(seat(page, player)).toHaveAttribute('data-expression', faces[index]!);
    await expect(page.getByTestId(`avatar-${player}`)).toHaveAttribute('data-expression', faces[index]!);
    await expect(seat(page, player)).toHaveAttribute('data-lit', 'false');
  }
  await expect(page.locator('[data-glow="true"]')).toHaveCount(0);
  await expect(end.getByRole('button', { name: 'Play again' })).toBeVisible();
  await attachScreenshot(page, testInfo, 'full-match');

  // The title screen counts one more game for Easy, of the right kind, and offers no Continue.
  await end.getByRole('button', { name: 'Title screen' }).click();
  await expect(page.getByTestId('title-screen')).toBeVisible();
  expect(await total()).toBe(before + 1);
  const kind = result.startsWith('You win') ? 'data-wins' : result.startsWith('Draw') ? 'data-draws' : 'data-losses';
  await expect(easy).toHaveAttribute(kind, '1');
  await expect(page.getByTestId('continue')).toHaveCount(0);
  await page.reload();
  expect(await total()).toBe(before + 1);
});

test('[scenario:two-player-match] both seats play glowing takes to the end screen, which names the winning seat or the draw; the sitting counts it and the results do not', async ({ page }, testInfo) => {
  test.setTimeout(120_000);
  await openTitle(page);
  const results = await readResults(page);
  await chooseTwoPlayers(page);

  // The test drives both seats; each take is made by the player whose seat is lit.
  const end = page.getByTestId('end-screen');
  for (;;) {
    if (await end.isVisible()) break;
    const takes = await takeCount(page);
    if (takes >= 20) throw new Error('The game did not end within 20 takes.');
    const player = await toMove(page);
    await expect(seat(page, player)).toHaveAttribute('data-lit', 'true');
    await takeGlowing(page);
  }

  // The end screen names the winning seat or the draw, and how it happened.
  const by = (await end.getAttribute('data-by'))!;
  const winner = (await end.getAttribute('data-winner'))!;
  const result = (await page.getByTestId('result').textContent())!;
  expect(result).toMatch(RESULT);
  expect(result).toMatch(winner === 'draw' ? /^Draw: the board is full$/ : new RegExp(`^Player ${winner === 'A' ? 1 : 2} wins by ${{ line: 'a line', square: 'a square', blockade: 'blockade' }[by as 'line']}$`));
  await expect(page.getByTestId('result-detail')).not.toContainText(/\b(you|bot)\b/i);
  await expect(page.locator('[data-testid="toast"]')).toHaveCount(0);

  // The score of the sitting counts it, and the seats show the result.
  const score = await readScore(page);
  expect(score).toEqual({
    a: winner === 'A' ? 1 : 0,
    b: winner === 'B' ? 1 : 0,
    draws: winner === 'draw' ? 1 : 0,
    text: `Score of this sitting: Player 1 ${winner === 'A' ? 1 : 0} – ${winner === 'B' ? 1 : 0} Player 2${winner === 'draw' ? ' · 1 draw' : ''}`,
  });
  if (winner !== 'draw') {
    await expect(seat(page, winner as 'A' | 'B')).toHaveAttribute('data-expression', 'won');
    await expect(seat(page, winner as 'A' | 'B')).toHaveAttribute('data-score', '1');
    await expect(seatStatus(page, winner as 'A' | 'B')).toHaveText('Winner');
  }
  await expect(end.getByRole('button', { name: 'Play again' })).toBeVisible();
  await attachScreenshot(page, testInfo, 'two-player-match');

  // The results by difficulty are unchanged.
  await end.getByRole('button', { name: 'Title screen' }).click();
  expect(await readResults(page)).toEqual(results);
  await page.reload();
  expect(await readResults(page)).toEqual(results);
});

test('[scenario:sitting-score] the score of a sitting counts finished games across Play again, survives a reload with Continue, and resets on leaving to the title', async ({ page }, testInfo) => {
  test.setTimeout(120_000);
  await startTwoPlayerGame(page, { seed: HUMAN_STARTS });
  expect(await readScore(page)).toMatchObject({ a: 0, b: 0, draws: 0 });

  /** Plays the game out and returns the seat that won, or 'draw'. */
  async function finish() {
    await playToEnd(page, 20);
    return (await page.getByTestId('end-screen').getAttribute('data-winner'))!;
  }
  const add = (score: { a: number; b: number; draws: number }, winner: string) => ({
    a: score.a + (winner === 'A' ? 1 : 0),
    b: score.b + (winner === 'B' ? 1 : 0),
    draws: score.draws + (winner === 'draw' ? 1 : 0),
  });

  // After a finished game the score shows it.
  let expected = add({ a: 0, b: 0, draws: 0 }, await finish());
  expect(await readScore(page)).toMatchObject(expected);
  const firstStarter = await match(page).getAttribute('data-starter');

  // Play again keeps the score and swaps the starter; a second finished game adds to it.
  await page.getByRole('button', { name: 'Play again' }).click();
  await expect(page.getByTestId('end-screen')).toHaveCount(0);
  await expect(match(page)).toHaveAttribute('data-starter', firstStarter === 'A' ? 'B' : 'A');
  expect(await readScore(page)).toMatchObject(expected);
  await expect(seat(page, 'A')).toHaveAttribute('data-score', String(expected.a));
  await expect(seat(page, 'B')).toHaveAttribute('data-score', String(expected.b));
  expected = add(expected, await finish());
  expect(await readScore(page)).toMatchObject(expected);
  expect(expected.a + expected.b + expected.draws).toBe(2);

  // A reload with Continue in mid-game restores the score.
  await page.getByRole('button', { name: 'Play again' }).click();
  await takeGlowing(page);
  await takeGlowing(page);
  const scoreText = (await readScore(page)).text;
  await page.reload();
  await page.getByTestId('continue').click();
  await expect(board(page)).toBeVisible();
  expect(await readScore(page)).toEqual({ ...expected, text: scoreText });
  await expect(seat(page, 'A')).toHaveAttribute('data-score', String(expected.a));
  await expect(seat(page, 'B')).toHaveAttribute('data-score', String(expected.b));
  await attachScreenshot(page, testInfo, 'sitting-score');

  // Leaving to the title screen and starting a New game resets it to zero.
  await page.getByTestId('menu-button').click();
  await page.getByRole('button', { name: /^Quit to title/ }).click();
  await chooseTwoPlayers(page);
  expect(await readScore(page)).toEqual({ a: 0, b: 0, draws: 0, text: 'Score of this sitting: Player 1 0 – 0 Player 2' });
  await expect(seat(page, 'A')).toHaveAttribute('data-score', '0');
  await expect(seat(page, 'B')).toHaveAttribute('data-score', '0');
});

test('[scenario:starter-alternates] Play again after a finished game starts a new game in the same mode with the other player starting', async ({ page }, testInfo) => {
  test.setTimeout(240_000);
  await startGame(page, { seed: HUMAN_STARTS, difficulty: 'Easy' });
  await expect(match(page)).toHaveAttribute('data-starter', 'A');
  await expect(seatStatus(page, 'A')).toHaveText('Your move');
  await playToEnd(page, 20);

  // Play again: a fresh board in the same mode, the bot starts.
  await page.getByRole('button', { name: 'Play again' }).click();
  await expect(page.getByTestId('end-screen')).toHaveCount(0);
  await expect(match(page)).toHaveAttribute('data-mode', 'bot');
  await expect(match(page)).toHaveAttribute('data-starter', 'B');
  await expect(page.getByTestId('announcer')).toHaveText('The bot starts. Bot is thinking.');
  expect(await takeCount(page)).toBe(0);
  await expect(board(page).getByTestId('token')).toHaveCount(0);
  await expect(seat(page, 'A')).toHaveAttribute('data-tokens-left', '8');
  await attachScreenshot(page, testInfo, 'starter-alternates');

  // The bot opens with an edge tile.
  await waitForHumanTurn(page);
  const opened = (await readBoard(page)).filter((cell) => cell.owner !== null);
  expect(opened.map((cell) => cell.owner)).toEqual(['B']);
  expect(isEdge(opened[0]!.cell)).toBe(true);

  // In a two-player game too: Play again hands the start to the other seat and stays two-player.
  await page.getByTestId('menu-button').click();
  await page.getByRole('button', { name: /^Quit to title/ }).click();
  await chooseTwoPlayers(page);
  const starter = (await match(page).getAttribute('data-starter'))!;
  await playToEnd(page, 20);
  await page.getByRole('button', { name: 'Play again' }).click();
  await expect(match(page)).toHaveAttribute('data-mode', 'two-player');
  await expect(match(page)).toHaveAttribute('data-starter', starter === 'A' ? 'B' : 'A');
  const next = starter === 'A' ? 'B' : 'A';
  await expect(seatStatus(page, next)).toHaveText(`Player ${next === 'A' ? 1 : 2}'s move`);
  await expect(glowing(page)).toHaveCount(12);
});

test('[scenario:sound-toggle] sound starts only after a user action, the menu’s mute survives a reload, and nothing plays while muted', async ({ page }, testInfo) => {
  // Count audio contexts and tones started in the page, before any app script runs.
  await page.addInitScript(() => {
    const counts = { contexts: 0, tones: 0 };
    (window as unknown as { __audio: typeof counts }).__audio = counts;
    const Original = window.AudioContext;
    window.AudioContext = class extends Original {
      constructor(options?: AudioContextOptions) {
        super(options);
        counts.contexts += 1;
      }
      override createOscillator() {
        const oscillator = super.createOscillator();
        const start = oscillator.start.bind(oscillator);
        oscillator.start = (when?: number) => {
          counts.tones += 1;
          start(when);
        };
        return oscillator;
      }
    };
  });
  const audio = () => page.evaluate(() => (window as unknown as { __audio: { contexts: number; tones: number } }).__audio);

  await openTitle(page);
  await page.waitForTimeout(300);
  expect(await audio()).toEqual({ contexts: 0, tones: 0 });

  // The first user action creates the audio; starting a game plays a short sound.
  await page.getByRole('button', { name: /^New game/ }).click();
  expect((await audio()).contexts).toBe(1);
  await page.getByRole('button', { name: /^Versus bot/ }).click();
  await page.getByRole('button', { name: /^Easy\b/ }).click();
  await expect.poll(async () => (await audio()).tones).toBeGreaterThan(0);

  // Mute from the game menu; the setting survives a reload.
  await openMenu(page);
  const sound = page.getByRole('switch', { name: 'Sound' });
  await sound.click();
  await expect(sound).toHaveAttribute('aria-checked', 'false');
  await page.reload();
  await page.getByTestId('continue').click();
  await openMenu(page);
  await expect(page.getByRole('switch', { name: 'Sound' })).toHaveAttribute('aria-checked', 'false');
  await page.keyboard.press('Escape');

  // While muted, a take, the bot's reply and a refusal play nothing; every event is still shown.
  await takeGlowing(page);
  await waitForHumanTurn(page);
  const botCell = (await readBoard(page)).find((cell) => cell.owner === 'B')!;
  await expect(takeToast(page)).toContainText(`Bot took ${botCell.cell}`);
  await cellAt(page, botCell.cell).click();
  await expect(refusalToast(page)).toHaveText(`${tile(botCell)} at ${botCell.cell} was already taken; a token stands there now.`);
  expect(await audio()).toEqual({ contexts: 0, tones: 0 });
  await attachScreenshot(page, testInfo, 'sound-toggle');

  // Unmuted again in the menu, the next take is heard.
  await openMenu(page);
  await page.getByRole('switch', { name: 'Sound' }).click();
  await page.keyboard.press('Escape');
  await takeGlowing(page);
  await expect.poll(async () => (await audio()).tones, { timeout: BOT_REPLY_MS }).toBeGreaterThan(0);
});
