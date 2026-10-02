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
  fixRandomness,
  gameSnapshot,
  glowing,
  HUMAN_STARTS,
  isEdge,
  legalFromPage,
  openTitle,
  playToEnd,
  readBoard,
  readLastTile,
  refusalToast,
  startGame,
  takeCount,
  takeGlowing,
  toasts,
  waitForHumanTurn,
} from './helpers';

// Randomness is fixed per test through `fixRandomness`; tiles, tokens and the last tile are read
// from the page, and no test depends on which tile the bot takes.
const TITLE = 'Constraint';
const FIGHTER_WORDS = /\b(fighters?|traps?|recharges?|rosters?|objectives?|abilit(y|ies)|setup)\b/i;

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
  await page.getByRole('button', { name: 'Got it' }).click();
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

test('[scenario:new-game] New game: a difficulty, then the board at once with all 16 tiles, and the top bar says who starts', async ({ page, browser }, testInfo) => {
  await openTitle(page, HUMAN_STARTS);
  await page.getByRole('button', { name: /^New game/ }).click();
  const choices = page.getByTestId('difficulty-screen').locator('button[data-difficulty]');
  await expect(choices).toHaveCount(3);
  expect(await choices.evaluateAll((buttons) => buttons.map((button) => button.getAttribute('data-difficulty')))).toEqual(['easy', 'normal', 'hard']);
  await expect(page.getByRole('button', { name: /^Hard\b/ })).toBeVisible();
  await expectNoLeftovers(page);
  await page.getByRole('button', { name: /^Normal\b/ }).click();

  // The board at once: 16 tiles, one of each terrain and symbol pair, each drawn with its scene and emblem, and no token.
  await expect(board(page)).toBeVisible();
  const cells = await readBoard(page);
  expect(cells).toHaveLength(16);
  expect(new Set(cells.map(tile)).size).toBe(16);
  expect(cells.every((cell) => cell.owner === null)).toBe(true);
  await expect(board(page).locator('svg.scene')).toHaveCount(16);
  await expect(board(page).locator('.tile-symbol svg.emblem-svg')).toHaveCount(16);
  await expect(board(page).getByTestId('token')).toHaveCount(0);
  await expectNoLeftovers(page);

  // The top bar says who starts: here the player.
  await expect(page.getByTestId('starter')).toHaveText('You start');
  await expect(page.getByTestId('turn')).toHaveText('Your turn');
  await expect(page.getByTestId('last-tile')).toHaveText('Any edge tile');
  await expect(page.getByTestId('tokens-you')).toHaveAttribute('data-left', '8');
  await expect(page.getByTestId('tokens-bot')).toHaveAttribute('data-left', '8');
  await attachScreenshot(page, testInfo, 'new-game');

  // Under other randomness the bot starts, says so, and opens with an edge tile.
  const context = await browser.newContext({ baseURL: testInfo.project.use.baseURL!, reducedMotion: 'reduce' });
  const other = await context.newPage();
  await openTitle(other, BOT_STARTS);
  await chooseDifficulty(other, 'Easy');
  await expect(other.getByTestId('starter')).toHaveText('Bot starts');
  await expect(other.getByTestId('turn')).toHaveAttribute('data-to-move', 'B');
  await waitForHumanTurn(other);
  const opened = (await readBoard(other)).filter((cell) => cell.owner === 'bot');
  expect(opened).toHaveLength(1);
  expect(isEdge(opened[0]!.cell)).toBe(true);
  await expect(other.getByTestId('starter')).toHaveCount(0);
  await context.close();
});

test('[scenario:match-screen] the game is the board, both token counts, a slim top bar and a menu button, and no panel', async ({ page }, testInfo) => {
  await startGame(page);
  await takeGlowing(page);
  await waitForHumanTurn(page);

  // The top bar: whose turn, the last tile as two emblems with names, both token counts and the menu.
  await expect(page.getByTestId('turn')).toHaveText('Your turn');
  const last = (await readLastTile(page))!;
  await expect(page.getByTestId('last-tile-terrain')).toHaveText(last.terrain);
  await expect(page.getByTestId('last-tile-terrain').locator('svg[data-shape]')).toHaveCount(1);
  await expect(page.getByTestId('last-tile-symbol')).toHaveText(last.symbol);
  await expect(page.getByTestId('last-tile-symbol').locator('svg[data-shape]')).toHaveCount(1);
  await expect(page.getByTestId('last-tile')).toHaveAttribute('aria-label', `Last tile: ${tile(last)}`);
  await expect(page.getByRole('img', { name: 'Your tokens: 7 of 8 left' })).toBeVisible();
  await expect(page.getByRole('img', { name: "Bot's tokens: 7 of 8 left" })).toBeVisible();
  await expect(page.getByTestId('tokens-you')).toContainText('You 7/8');
  await expect(page.getByTestId('tokens-bot')).toContainText('Bot 7/8');
  await expect(page.getByRole('button', { name: 'Menu' })).toBeVisible();

  // The board, with both tokens on it.
  await expect(board(page).locator('[data-cell]')).toHaveCount(16);
  await expect(board(page).locator('[data-owner="you"] [data-testid="token"]')).toHaveCount(1);
  await expect(board(page).locator('[data-owner="bot"] [data-testid="token"]')).toHaveCount(1);

  // Nothing else: no log, last actions, status, legend, tray or settings panel.
  for (const testId of ['log', 'resolution', 'status', 'legend', 'settings', 'menu-settings', 'own-tray', 'bot-tray', 'actions', 'chooser', 'goal-chip', 'recharges']) {
    await expect(page.getByTestId(testId), testId).toHaveCount(0);
  }
  for (const name of [/^Log$/, /^Last actions$/, /^Status$/, /tray/i, /^Settings$/, /legend/i]) {
    await expect(page.getByRole('heading', { name }), String(name)).toHaveCount(0);
    await expect(page.getByRole('region', { name }), String(name)).toHaveCount(0);
  }
  await expect(page.getByRole('switch')).toHaveCount(0);
  await expect(page.locator('main > *')).toHaveCount(3); // the hidden heading, the top bar and the table
  const text = await page.locator('main').innerText();
  expect(text).not.toMatch(/Turn \d|\bLog\b|Last actions/);
  await expectNoLeftovers(page);
  await attachScreenshot(page, testInfo, 'match-screen');
});

test('[scenario:opening-take] at the opening only the 12 edge tiles glow, an inner tile is refused, and an edge take places a token and sets the last tile', async ({ page }, testInfo) => {
  await startGame(page, { seed: HUMAN_STARTS });
  await expect(page.getByTestId('starter')).toHaveText('You start');
  await expect(page.getByTestId('last-tile')).toHaveText('Any edge tile');

  const cells = await readBoard(page);
  const lit = cells.filter((cell) => cell.glow).map((cell) => cell.cell);
  expect(lit).toHaveLength(12);
  expect(lit).toEqual(cells.filter((cell) => isEdge(cell.cell)).map((cell) => cell.cell));
  for (const cell of cells.filter((candidate) => candidate.glow)) expect(cell.label).toBe(`${cell.cell}, ${tile(cell)}, legal take`);

  // An inner tile is refused with its reason, and nothing is taken.
  const inner = cells.find((cell) => cell.cell === 'B2')!;
  await cellAt(page, 'B2').click();
  await expect(refusalToast(page)).toHaveText(`${tile(inner)} is not an edge tile; the first take must come from the edge.`);
  expect(await takeCount(page)).toBe(0);
  await expect(cellAt(page, 'B2')).not.toHaveAttribute('data-owner', /.+/);

  // An edge tile: the player's token takes its place, it is marked as the last take and shown as the last tile.
  const edge = cells.find((cell) => cell.cell === lit[lit.length - 1])!;
  await cellAt(page, edge.cell).click();
  await expect(cellAt(page, edge.cell)).toHaveAttribute('data-owner', 'you');
  await expect(cellAt(page, edge.cell).getByTestId('token')).toHaveAttribute('data-owner', 'you');
  await expect(cellAt(page, edge.cell).locator('svg.scene')).toHaveCount(0);
  await expect(page.getByTestId('last-tile')).toHaveAttribute('data-terrain', edge.terrain);
  await expect(page.getByTestId('last-tile')).toHaveAttribute('data-symbol', edge.symbol);
  await expect(page.getByTestId('last-tile-terrain')).toHaveText(edge.terrain);
  await expect(page.getByTestId('last-tile-symbol')).toHaveText(edge.symbol);
  await expect(page.getByTestId('tokens-you')).toHaveAttribute('data-left', '7');
  await attachScreenshot(page, testInfo, 'opening-take');
});

test('[scenario:legal-turn] after the bot’s take its cell is marked, exactly the matching tiles glow, a non-matching tile is refused, and a matching take hands the turn back', async ({ page }, testInfo) => {
  await startGame(page);
  await takeGlowing(page);
  await waitForHumanTurn(page);
  await expect(page.getByTestId('turn')).toHaveText('Your turn');
  expect(await takeCount(page)).toBe(2);

  // The bot's take is marked as the last one, and its tile is the last tile.
  const cells = await readBoard(page);
  const marked = cells.filter((cell) => cell.last);
  expect(marked).toHaveLength(1);
  const botCell = marked[0]!;
  expect(botCell.owner).toBe('bot');
  expect(botCell.label).toBe(`${botCell.cell}, bot's token, last take`);
  expect(await readLastTile(page)).toEqual({ terrain: botCell.terrain, symbol: botCell.symbol });

  // Exactly the free tiles sharing its terrain or symbol glow.
  const { legal, illegal } = await legalFromPage(page);
  expect(legal.length).toBeGreaterThan(0);
  expect(cells.filter((cell) => cell.glow).map((cell) => cell.cell)).toEqual(legal);

  // A tile that matches neither is refused with a reason naming both tiles; the turn stays.
  const wrong = illegal[0]!;
  await cellAt(page, wrong.cell).click();
  await expect(refusalToast(page)).toHaveText(`${tile(wrong)} matches neither ${botCell.terrain} nor ${botCell.symbol}`);
  expect(await takeCount(page)).toBe(2);
  await expect(page.getByTestId('turn')).toHaveText('Your turn');
  await attachScreenshot(page, testInfo, 'legal-turn');

  // A matching take hands the turn to the bot, which replies.
  await cellAt(page, legal[0]!).click();
  await expect(cellAt(page, legal[0]!)).toHaveAttribute('data-owner', 'you');
  await expect(page.getByTestId('turn')).toHaveText('Bot is thinking');
  await expect(page.getByTestId('turn')).toHaveAttribute('data-to-move', 'B');
  await waitForHumanTurn(page);
  expect(await takeCount(page)).toBe(4);
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

  const lit = page.locator('[data-glow="true"], .glow, .glow-dot');
  await expect(lit).toHaveCount(0);

  // The opening: an inner tile is refused with its reason, an edge tile is taken.
  const opening = await readBoard(page);
  await cellAt(page, 'C3').click();
  await expect(refusalToast(page)).toHaveText(`${tile(opening.find((cell) => cell.cell === 'C3')!)} is not an edge tile; the first take must come from the edge.`);
  expect(await takeCount(page)).toBe(0);
  await cellAt(page, 'A1').click();
  await expect(cellAt(page, 'A1')).toHaveAttribute('data-owner', 'you');
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
  await expect(cellAt(page, legal[0]!)).toHaveAttribute('data-owner', 'you');
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

test('[scenario:how-to-play] How to Play opens from the title and the game menu, explains the rules with board diagrams, closes with Escape or its button, and returns focus', async ({ page }, testInfo) => {
  await openTitle(page);
  const dialog = page.getByRole('dialog', { name: 'How to play' });
  const opener = page.getByTestId('title-screen').getByRole('button', { name: 'How to play' });
  await opener.click();
  await expect(dialog).toBeVisible();
  await expect(page.getByRole('button', { name: 'Close How to play' })).toBeFocused();

  // Taking a matching tile, the edge opening, lines and squares, the blockade and the draw, each with a small board.
  await expect(dialog.locator('[data-section="taking"]')).toContainText('same terrain or the same symbol');
  await expect(dialog.getByTestId('matching-example')).toContainText('✓ matches (same terrain)');
  await expect(dialog.getByTestId('matching-example')).toContainText('✗ no match');
  await expect(dialog.locator('[data-section="opening"]')).toContainText('edge');
  await expect(dialog.locator('[data-section="shapes"]')).toContainText('2×2 square');
  await expect(dialog.locator('[data-section="shapes"]')).toContainText('diagonal');
  await expect(dialog.locator('[data-section="blockade"]')).toContainText('cannot take');
  await expect(dialog.locator('[data-section="draw"]')).toContainText('draw');
  for (const id of ['opening', 'line', 'square', 'blockade', 'draw']) {
    const diagram = dialog.getByTestId(`diagram-${id}`);
    await expect(diagram.locator('.mini-cell')).toHaveCount(16);
  }
  await expect(dialog.getByTestId('diagram-opening').locator('[data-mark="glow"]')).toHaveCount(12);
  await expect(dialog.getByTestId('diagram-line').locator('[data-mark="shape"]')).toHaveCount(4);
  await expect(dialog.getByTestId('diagram-square').locator('[data-mark="shape"]')).toHaveCount(4);
  await expect(dialog.getByTestId('diagram-draw').locator('[data-token]')).toHaveCount(16);
  await expect(dialog).not.toContainText(/fighter|trap|recharge|roster|objective/i);

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

test('[scenario:resume-match] after a reload, Continue restores the same board, tokens, last tile and turn', async ({ page }, testInfo) => {
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
  expect(before.counts).toBe('5/5');

  await page.reload();
  const resume = page.getByTestId('continue');
  await expect(resume).toBeVisible();
  await expect(resume).toContainText('Normal bot, 6 tiles taken');
  await resume.click();
  await expect(board(page)).toBeVisible();
  expect(await gameSnapshot(page)).toEqual(before);
  await expect(page.getByTestId('turn')).toHaveText('Your turn');
  // A resumed game starts quiet: no toast from earlier takes.
  await expect(toasts(page)).toHaveCount(0);

  // The restored game goes on: one more take and the bot's reply.
  await takeGlowing(page);
  await waitForHumanTurn(page);
  expect(await takeCount(page)).toBeGreaterThanOrEqual(7);
  await attachScreenshot(page, testInfo, 'resume-match');
});

test('[scenario:full-match] glowing takes play a game to its end screen, which names the result, marks the winning shape and is counted', async ({ page }, testInfo) => {
  test.setTimeout(240_000);
  await openTitle(page);
  const easy = page.getByTestId('results').locator('tr[data-difficulty="easy"]');
  const total = async () =>
    (await Promise.all(['data-wins', 'data-losses', 'data-draws'].map((name) => easy.getAttribute(name)))).reduce((sum, value) => sum + Number(value), 0);
  const before = await total();
  await chooseDifficulty(page, 'Easy');
  await playToEnd(page, 20);

  // The end screen names the result and how it happened.
  const end = page.getByTestId('end-screen');
  const by = (await end.getAttribute('data-by'))!;
  expect(['line', 'square', 'blockade', 'full-board']).toContain(by);
  const result = (await page.getByTestId('result').textContent())!;
  const expected = { line: / with a line$/, square: / with a square$/, blockade: / by blockade$/, 'full-board': /^Draw: the board is full$/ }[by]!;
  expect(result).toMatch(/^(You win|The bot wins|Draw)/);
  expect(result).toMatch(expected);
  await expect(page.getByTestId('turn')).toHaveText(result);
  await expect(page.locator('[data-testid="toast"][data-kind="end"]')).toHaveText(result);
  const detail = (await page.getByTestId('result-detail').textContent())!;

  // The winning shape's four cells are marked on the board, and hold the winner's tokens.
  const cells = await readBoard(page);
  const winning = cells.filter((cell) => cell.winning);
  if (by === 'line' || by === 'square') {
    expect(winning).toHaveLength(4);
    const owner = result.startsWith('You') ? 'you' : 'bot';
    for (const cell of winning) expect(cell.owner).toBe(owner);
    const ids = winning.map((cell) => cell.cell).sort().join();
    expect((by === 'line' ? LINES : SQUARES).some((shape) => [...shape].sort().join() === ids)).toBe(true);
    for (const cell of winning) expect(detail).toContain(cell.cell);
  } else {
    expect(winning).toHaveLength(0);
    if (by === 'full-board') expect(cells.every((cell) => cell.owner !== null)).toBe(true);
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

test('[scenario:starter-alternates] Play again after a finished game starts a new game with the other player starting', async ({ page }, testInfo) => {
  test.setTimeout(300_000);
  await startGame(page, { seed: HUMAN_STARTS, difficulty: 'Easy' });
  await expect(page.getByTestId('starter')).toHaveAttribute('data-starter', 'A');
  await expect(page.getByTestId('starter')).toHaveText('You start');
  await playToEnd(page, 20);

  // Play again: a fresh board, the bot starts.
  await page.getByRole('button', { name: 'Play again' }).click();
  await expect(page.getByTestId('end-screen')).toHaveCount(0);
  await expect(page.getByTestId('starter')).toHaveAttribute('data-starter', 'B');
  await expect(page.getByTestId('starter')).toHaveText('Bot starts');
  expect(await takeCount(page)).toBe(0);
  await expect(board(page).getByTestId('token')).toHaveCount(0);
  await expect(page.getByTestId('tokens-you')).toHaveAttribute('data-left', '8');
  await attachScreenshot(page, testInfo, 'starter-alternates');

  // The bot opens with an edge tile, then the game is played out; Play again hands the start back to the player.
  await waitForHumanTurn(page);
  const opened = (await readBoard(page)).filter((cell) => cell.owner !== null);
  expect(opened.map((cell) => cell.owner)).toEqual(['bot']);
  expect(isEdge(opened[0]!.cell)).toBe(true);
  await playToEnd(page, 20);
  await page.getByRole('button', { name: 'Play again' }).click();
  await expect(page.getByTestId('starter')).toHaveAttribute('data-starter', 'A');
  await expect(page.getByTestId('starter')).toHaveText('You start');
  await expect(page.getByTestId('turn')).toHaveText('Your turn');
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

  // The first user action creates the audio; choosing a difficulty plays a short sound.
  await page.getByRole('button', { name: /^New game/ }).click();
  expect((await audio()).contexts).toBe(1);
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
  const botCell = (await readBoard(page)).find((cell) => cell.owner === 'bot')!;
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
