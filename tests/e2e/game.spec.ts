/// <reference lib="dom" />
// The DOM library types the callbacks that run in the page (page.evaluate).
import { expect, test, type Page } from '@playwright/test';
import { FIGHTERS } from '@okiya/content';
import {
  attachScreenshot,
  board,
  cellsOf,
  deployFirst,
  fixRandomness,
  glowing,
  HUMAN_STARTS,
  isEdge,
  matchSnapshot,
  MOVES_AND_ABILITY,
  openSetup,
  openTitle,
  ownTray,
  playGlowingAction,
  startMatch,
  toasts,
  trayTokens,
  turnNumber,
  waitForHumanTurn,
} from './helpers';

// Randomness is fixed per test through `fixRandomness`; cells, tokens and constraints are read from the page.
/** With randomness 5 and the Easy bot, playing the first glowing action ends a match in a few dozen actions. */
const FULL_MATCH = 5;
const MAX_ACTIONS = 200;
const TITLE = 'Constraint';

/** No playtest helper is visible on the page (PRD E1). */
async function expectNoHelpers(page: Page) {
  const text = await page.locator('body').innerText();
  expect(text).not.toMatch(/\bseed\b|preset|scenario|spec-v0/i);
  await expect(page.locator('[data-testid="rules"], [data-testid="seed"], [data-testid="preset"], [data-rule]')).toHaveCount(0);
  await expect(page.locator('input[name="seed"], select, [data-testid="preset-choices"], [data-testid="scenario-select"]')).toHaveCount(0);
}

/** Opens the match menu with its button. */
async function openMenu(page: Page) {
  await page.getByTestId('menu-button').click();
  await expect(page.getByRole('dialog', { name: 'Menu' })).toBeVisible();
}

const ADJACENT = (a: string, b: string) => Math.abs(a.charCodeAt(0) - b.charCodeAt(0)) + Math.abs(Number(a[1]) - Number(b[1])) === 1;

test('[scenario:title-screen] the title screen offers New game, Continue for a saved match, How to play, results and a settings menu', async ({ page }, testInfo) => {
  // The app reads no URL parameters: playtest parameters change nothing.
  await fixRandomness(page, HUMAN_STARTS);
  await page.goto('/?seed=7&preset=spec-v0.2-two-displacers&scenario=paper-test-01&depth=hard');
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
  for (const depth of ['easy', 'normal', 'hard']) {
    const row = results.locator(`tr[data-depth="${depth}"]`);
    await expect(row).toHaveAttribute('data-wins', '0');
    await expect(row).toHaveAttribute('data-losses', '0');
    await expect(row).toHaveAttribute('data-draws', '0');
  }
  await expect(results).toContainText('Easy');
  await expect(results).toContainText('Normal');
  await expect(results).toContainText('Hard');

  // The settings live in a menu, not on the page.
  await expect(page.getByRole('switch')).toHaveCount(0);
  const settings = title.getByRole('button', { name: 'Settings' });
  await settings.click();
  const dialog = page.getByRole('dialog', { name: 'Settings' });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole('switch', { name: 'Move highlights' })).toHaveAttribute('aria-checked', 'true');
  await expect(dialog.getByRole('switch', { name: 'Sound' })).toHaveAttribute('aria-checked', 'true');
  await page.keyboard.press('Escape');
  await expect(dialog).toHaveCount(0);
  await expect(settings).toBeFocused();
  await expectNoHelpers(page);

  // A started match is saved: quitting to the title offers Continue, and neither setup nor the match shows a helper.
  await openSetup(page, 'Normal');
  await expectNoHelpers(page);
  await page.getByRole('button', { name: 'Use default setup' }).click();
  await expect(board(page)).toBeVisible();
  await expectNoHelpers(page);
  await openMenu(page);
  await page.getByRole('button', { name: /^Quit to title/ }).click();
  const resume = page.getByTestId('continue');
  await expect(resume).toBeVisible();
  await expect(resume).toContainText('Normal bot');
  await expect(title.getByRole('button', { name: /^New game/ })).toContainText('replaces the saved match');
  await attachScreenshot(page, testInfo, 'title-screen');
});

test('[scenario:setup-flow] New game: a difficulty, four distinct fighter tokens, traps on tapped cells, then start', async ({ page }, testInfo) => {
  await openTitle(page);
  await page.getByRole('button', { name: /^New game/ }).click();
  const difficulties = page.getByTestId('difficulty-screen').locator('button[data-depth]');
  await expect(difficulties).toHaveCount(3);
  await page.getByRole('button', { name: /^Normal\b/ }).click();
  await expect(page.getByTestId('setup-board')).toBeVisible();
  await expect(page.getByTestId('bot-depth')).toHaveText('Bot: Normal');

  // The pool is nine tokens, one per fighter, each with its emblem.
  const pool = page.getByTestId('pool').getByRole('button');
  const roster = page.getByTestId('roster').getByRole('button');
  const refusal = page.getByTestId('setup-refusal');
  await expect(pool).toHaveCount(FIGHTERS.length);
  const names = await pool.evaluateAll((buttons) => buttons.map((button) => button.getAttribute('aria-label')!));
  expect(names).toEqual(FIGHTERS.map((fighter) => fighter.name));
  await expect(page.getByTestId('pool').locator('[data-testid="token"] svg[data-shape]')).toHaveCount(FIGHTERS.length);

  // Two fighters, then a duplicate, which is refused with its reason.
  await pool.nth(0).click();
  await pool.nth(1).click();
  await expect(roster).toHaveCount(2);
  await expect(pool.nth(0)).toHaveAttribute('aria-pressed', 'true');
  await pool.nth(0).click();
  await expect(refusal).toHaveText(`${names[0]} is already in your roster; fighters must be distinct.`);
  await expect(roster).toHaveCount(2);

  // Four distinct fighters, then a fifth, which is refused with its reason.
  await pool.nth(2).click();
  await pool.nth(3).click();
  await expect(roster).toHaveCount(4);
  await expect(refusal).toHaveCount(0);
  await pool.nth(4).click();
  await expect(refusal).toHaveText('A roster has exactly 4 fighters; this one has 5.');
  await expect(roster).toHaveCount(4);
  const chosen = FIGHTERS.slice(0, 4).map((fighter) => `A:${fighter.type}`);

  // The setup traps, placed by tapping cells of the revealed board.
  const trapCount = Number(await page.getByTestId('trap-count').textContent());
  expect(trapCount).toBe(2);
  const setupCells = page.getByTestId('setup-board').locator('[data-cell]');
  await expect(setupCells).toHaveCount(16);
  const trapCells: string[] = [];
  for (let i = 0; i < trapCount; i += 1) {
    const cell = setupCells.nth(i * 5);
    trapCells.push((await cell.getAttribute('data-cell'))!);
    await cell.click();
    await expect(cell).toHaveAttribute('data-own-trap', 'true');
    await expect(cell.getByTestId('trap-marker')).toBeVisible();
  }
  expect(new Set(trapCells).size).toBe(trapCount);
  await attachScreenshot(page, testInfo, 'setup-flow');
  await page.getByRole('button', { name: 'Start with this setup' }).click();

  // The match shows the chosen tokens in the tray and only the player's own traps.
  await expect(board(page)).toBeVisible();
  await expect(page.getByTestId('turn')).toHaveText('Your turn');
  expect((await trayTokens(page).evaluateAll((buttons) => buttons.map((button) => button.getAttribute('data-fighter')))).sort()).toEqual([...chosen].sort());
  await expect(board(page).locator('[data-own-trap="true"]')).toHaveCount(trapCount);
  for (const cell of trapCells) await expect(board(page).locator(`[data-cell="${cell}"]`)).toHaveAttribute('data-own-trap', 'true');
  await expect(page.getByText(/bot's trap/i)).toHaveCount(0);

  // The default setup starts a match too.
  await openMenu(page);
  await page.getByRole('button', { name: /^Quit to title/ }).click();
  await openSetup(page, 'Easy');
  await page.getByRole('button', { name: 'Use default setup' }).click();
  await expect(trayTokens(page)).toHaveCount(4);
  await expect(board(page).locator('[data-own-trap="true"]')).toHaveCount(2);
});

test('[scenario:match-screen] the match is the board, the trays, a slim top bar and a menu button, and no panel', async ({ page }, testInfo) => {
  await startMatch(page);
  await deployFirst(page);
  await waitForHumanTurn(page);

  // The top bar: whose turn, the constraint as two emblems with names, recharge pips for both sides, the goal chip and the menu.
  const bar = page.getByTestId('top-bar');
  await expect(page.getByTestId('turn')).toHaveText('Your turn');
  const constraint = page.getByTestId('constraint');
  const terrain = (await constraint.getAttribute('data-terrain'))!;
  const symbol = (await constraint.getAttribute('data-symbol'))!;
  await expect(page.getByTestId('constraint-terrain')).toHaveText(terrain);
  await expect(page.getByTestId('constraint-terrain').locator('svg[data-shape]')).toHaveCount(1);
  await expect(page.getByTestId('constraint-symbol')).toHaveText(symbol);
  await expect(page.getByTestId('constraint-symbol').locator('svg[data-shape]')).toHaveCount(1);
  await expect(constraint).toHaveAttribute('aria-label', `Constraint: ${terrain} or ${symbol}`);
  await expect(page.getByRole('img', { name: 'Your recharges: 3 of 3 left' })).toBeVisible();
  await expect(page.getByRole('img', { name: "Bot's recharges: 3 of 3 left" })).toBeVisible();
  await expect(bar.locator('.pip.on')).toHaveCount(6);
  await expect(page.getByTestId('goal-chip')).toHaveText('Goal: Square');
  await expect(page.getByRole('button', { name: 'Menu' })).toBeVisible();

  // The board, the bot's face-down tray above it and the player's tray under it.
  await expect(board(page).locator('[data-cell]')).toHaveCount(16);
  await expect(page.getByTestId('bot-tray').getByTestId('face-down-token')).toHaveCount(3);
  await expect(trayTokens(page)).toHaveCount(3);
  const boardBox = (await page.getByTestId('board-frame').boundingBox())!;
  expect((await page.getByTestId('bot-tray').boundingBox())!.y).toBeLessThan(boardBox.y);
  expect((await ownTray(page).boundingBox())!.y).toBeGreaterThan(boardBox.y + boardBox.height - 1);

  // None of the developer panels remain.
  for (const testId of ['log', 'resolution', 'status', 'charges', 'deployed', 'reserve', 'on-board', 'legend', 'settings', 'turn-prompt', 'actions', 'chooser', 'bot-depth']) {
    await expect(page.getByTestId(testId), testId).toHaveCount(0);
  }
  for (const name of [/^Log$/, /^Last actions$/, /^Status$/, /reserve/i, /^On the board$/, /^Settings$/, /legend/i]) {
    await expect(page.getByRole('heading', { name }), String(name)).toHaveCount(0);
    await expect(page.getByRole('region', { name }), String(name)).toHaveCount(0);
  }
  await expect(page.getByRole('switch')).toHaveCount(0);
  await expect(page.locator('main > *')).toHaveCount(3); // the hidden heading, the top bar and the table
  const text = await page.locator('main').innerText();
  expect(text).not.toMatch(/Turn \d|legal action|\bLog\b|Last actions/);
  await attachScreenshot(page, testInfo, 'match-screen');
});

test('[scenario:piece-tray] tray tokens deploy by tapping a token then a glowing cell, and each tray hides once empty', async ({ page }, testInfo) => {
  await startMatch(page);
  const botTray = page.getByTestId('bot-tray');
  await expect(trayTokens(page)).toHaveCount(4);
  await expect(botTray.getByTestId('face-down-token')).toHaveCount(4);
  // The bot's tokens are face down: no fighter, only their number.
  await expect(botTray).toHaveAttribute('aria-label', "Bot's tray: 4 face-down tokens");
  for (const fighter of FIGHTERS) await expect(botTray).not.toContainText(fighter.name);
  await expect(botTray.locator('[data-fighter]')).toHaveCount(0);
  for (const token of await trayTokens(page).all()) await expect(token).toHaveAttribute('aria-label', /^Your .+ in your tray, charged, not locked, not protected$/);

  // Tapping a tray token makes the legal cells glow, here every one an outside edge cell.
  const first = trayTokens(page).first();
  await first.click();
  await expect(first).toHaveAttribute('aria-pressed', 'true');
  const opening = await cellsOf(glowing(page));
  expect(opening.length).toBeGreaterThan(0);
  for (const cell of opening) expect(isEdge(cell)).toBe(true);
  await attachScreenshot(page, testInfo, 'piece-tray');
  const fighter = (await first.getAttribute('data-fighter'))!;
  await glowing(page).first().click();
  await expect(board(page).locator(`[data-cell="${opening[0]}"] [data-fighter="${fighter}"]`)).toHaveCount(1);
  await expect(trayTokens(page)).toHaveCount(3);
  await waitForHumanTurn(page);
  await expect(botTray).toHaveAttribute('data-count', '3');

  // Deploy the rest, each from the tray onto a glowing cell; the tray disappears with the last one.
  for (let turn = 0; turn < 8 && (await ownTray(page).count()) > 0; turn += 1) {
    await waitForHumanTurn(page);
    const count = await trayTokens(page).count();
    let deployed = false;
    for (let i = 0; i < count && !deployed; i += 1) {
      await trayTokens(page).nth(i).click();
      if ((await glowing(page).count()) > 0) {
        await glowing(page).first().click();
        deployed = true;
      }
    }
    if (!deployed) await playGlowingAction(page);
    if (deployed) await expect(trayTokens(page)).toHaveCount(count - 1);
  }
  await expect(ownTray(page)).toHaveCount(0);
  await expect(board(page).locator('[data-owner="A"]')).toHaveCount(4);

  // The bot's tray hides too once it has deployed its last token.
  await waitForHumanTurn(page);
  await expect(botTray).toHaveCount(0);
  await expect(board(page).locator('[data-owner="B"]')).toHaveCount(4);
});

test('[scenario:piece-actions] a token on the board glows its moves and shows its ability beside it; tapping away cancels; an illegal cell is refused', async ({ page }, testInfo) => {
  await startMatch(page, { seed: MOVES_AND_ABILITY });
  const { cell: home, fighter } = await deployFirst(page);
  await waitForHumanTurn(page);
  const token = board(page).locator(`[data-cell="${home}"]`);
  const actions = page.getByTestId('token-actions');

  // Tapping the token: its move cells glow and its legal ability button appears beside it.
  await token.click();
  await expect(token).toHaveAttribute('aria-pressed', 'true');
  const moves = await cellsOf(glowing(page));
  expect(moves.length).toBeGreaterThan(0);
  for (const cell of moves) expect(ADJACENT(cell, home)).toBe(true);
  await expect(actions).toBeVisible();
  await expect(page.locator(`[data-slot="${home}"] [data-testid="token-actions"]`)).toHaveCount(1);
  await expect(actions.getByRole('button')).toHaveCount(1);
  const ability = actions.getByRole('button', { name: /ability/ });
  await expect(ability).toHaveText('Teleport');
  // A charged token has no recharge: only legal buttons are shown.
  await expect(board(page).locator(`[data-cell="${home}"] [data-fighter="${fighter}"]`)).toHaveAttribute('data-charge', '1');
  await expect(actions.getByRole('button', { name: /Recharge/ })).toHaveCount(0);
  await attachScreenshot(page, testInfo, 'piece-actions');

  // Choosing the ability makes its targets glow instead.
  await ability.click();
  await expect(ability).toHaveAttribute('aria-pressed', 'true');
  const targets = await cellsOf(glowing(page));
  expect(targets.length).toBeGreaterThan(0);
  expect(targets).not.toEqual(moves);

  // Tapping away, off the board, cancels: nothing glows and the buttons go.
  await page.getByTestId('table').click({ position: { x: 4, y: 4 } });
  await expect(glowing(page)).toHaveCount(0);
  await expect(actions).toHaveCount(0);
  await expect(token).toHaveAttribute('aria-pressed', 'false');

  // An illegal cell is refused with its reason, and nothing is spent.
  const turn = await turnNumber(page);
  await token.click();
  const illegal = board(page).locator('[data-cell][data-occupied="false"][data-glow="false"]').last();
  const illegalCell = (await illegal.getAttribute('data-cell'))!;
  expect(moves).not.toContain(illegalCell);
  await illegal.click();
  const refusal = page.locator('[data-testid="toast"][data-kind="refusal"]');
  await expect(refusal).toHaveText(new RegExp(`^(${illegalCell} is not one orthogonal step from ${home}\\.|.+ does not match .+ or .+\\.)$`));
  expect(await turnNumber(page)).toBe(turn);
  await expect(token.locator(`[data-fighter="${fighter}"]`)).toHaveCount(1);

  // A glowing move still plays.
  await glowing(page).first().click();
  await expect.poll(() => turnNumber(page)).toBeGreaterThan(turn);
});

test('[scenario:legal-turn] a deploy on a glowing edge cell sets the constraint emblems, the bot replies and the turn comes back', async ({ page }, testInfo) => {
  await startMatch(page);
  const turn = page.getByTestId('turn');
  const constraint = page.getByTestId('constraint');
  await expect(turn).toHaveText('Your turn');
  await expect(constraint).toHaveText('Opening: any edge cell');

  await trayTokens(page).first().click();
  const lit = await cellsOf(glowing(page));
  expect(lit.length).toBeGreaterThan(0);
  for (const cell of lit) expect(isEdge(cell)).toBe(true);
  const target = glowing(page).first();
  const terrain = (await target.getAttribute('data-terrain'))!;
  const symbol = (await target.getAttribute('data-symbol'))!;
  await target.click();

  // The constraint emblems show the tile just played, and the bot takes its turn.
  await expect(constraint).toHaveAttribute('data-terrain', terrain);
  await expect(constraint).toHaveAttribute('data-symbol', symbol);
  await expect(page.getByTestId('constraint-terrain')).toHaveText(terrain);
  await expect(page.getByTestId('constraint-symbol')).toHaveText(symbol);
  await expect(board(page).locator(`[data-cell="${lit[0]}"]`)).toHaveAttribute('data-owner', 'A');

  // The bot replies with a deploy of its own, and the turn returns.
  await waitForHumanTurn(page);
  await expect(turn).toHaveText('Your turn');
  await expect(turn).toHaveAttribute('data-turn', '3');
  const botCell = board(page).locator('[data-owner="B"]');
  await expect(botCell).toHaveCount(1);
  await expect(botCell).toHaveAttribute('data-recent-player', 'B');
  await expect(page.getByTestId('bot-tray')).toHaveAttribute('data-count', '3');
  await expect(constraint).toHaveAttribute('data-terrain', (await botCell.getAttribute('data-terrain'))!);
  await expect(constraint).toHaveAttribute('data-symbol', (await botCell.getAttribute('data-symbol'))!);
  await expect(page.getByTestId('constraint-terrain')).toHaveText((await botCell.getAttribute('data-terrain'))!);
  await expect(page.getByTestId('constraint-symbol')).toHaveText((await botCell.getAttribute('data-symbol'))!);
  await attachScreenshot(page, testInfo, 'legal-turn');
});

test('[scenario:highlight-toggle] with highlights off in the menu nothing glows, a legal move works, an illegal one is refused, and the setting survives a reload', async ({ page }, testInfo) => {
  await startMatch(page);
  await openMenu(page);
  const highlights = page.getByRole('switch', { name: 'Move highlights' });
  await expect(highlights).toHaveAttribute('aria-checked', 'true');
  await highlights.click();
  await expect(highlights).toHaveAttribute('aria-checked', 'false');
  await page.getByRole('button', { name: 'Resume' }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);

  const lit = page.locator('[data-glow="true"], .glow, [data-playable]');
  await expect(lit).toHaveCount(0);

  // The opening: an inner cell is refused with its reason, an edge cell is legal.
  await trayTokens(page).first().click();
  await expect(trayTokens(page).first()).toHaveAttribute('aria-pressed', 'true');
  await expect(lit).toHaveCount(0);
  await board(page).locator('[data-cell="B2"]').click();
  await expect(page.locator('[data-testid="toast"][data-kind="refusal"]')).toHaveText('B2 is not on the outside edge; the opening deployment must be.');
  expect(await turnNumber(page)).toBe(1);
  await board(page).locator('[data-cell="A1"]').click();
  await expect(board(page).locator('[data-cell="A1"]')).toHaveAttribute('data-owner', 'A');
  await waitForHumanTurn(page);

  // Under a constraint: still nothing glows, and a non-matching cell is refused with its reason.
  const constraint = page.getByTestId('constraint');
  const terrain = (await constraint.getAttribute('data-terrain'))!;
  const symbol = (await constraint.getAttribute('data-symbol'))!;
  const turn = await turnNumber(page);
  await trayTokens(page).first().click();
  await expect(lit).toHaveCount(0);
  const refused = board(page).locator(`[data-cell][data-occupied="false"]:not([data-terrain="${terrain}"]):not([data-symbol="${symbol}"])`).first();
  await refused.click();
  await expect(page.locator('[data-testid="toast"][data-kind="refusal"]')).toContainText(`does not match ${terrain} or ${symbol}.`);
  expect(await turnNumber(page)).toBe(turn);
  await attachScreenshot(page, testInfo, 'highlight-toggle');

  // The setting is still off after a reload, on the title screen and in the restored match.
  await page.reload();
  await page.getByRole('button', { name: 'Settings' }).click();
  await expect(page.getByRole('switch', { name: 'Move highlights' })).toHaveAttribute('aria-checked', 'false');
  await page.keyboard.press('Escape');
  await page.getByTestId('continue').click();
  await trayTokens(page).first().click();
  await expect(lit).toHaveCount(0);
  await openMenu(page);
  await expect(page.getByRole('switch', { name: 'Move highlights' })).toHaveAttribute('aria-checked', 'false');
});

test('[scenario:event-toast] the bot’s reply enters a player trap: its cells stay marked and a short toast names the trigger, then fades', async ({ page }, testInfo) => {
  // Randomness 1 fixes the board, the player's default traps and the bot's private setup, so the
  // Easy bot's first reply enters one of the player's setup traps.
  await startMatch(page, { seed: HUMAN_STARTS, depth: 'Easy' });
  const ownTrapCells = await cellsOf(board(page).locator('[data-own-trap="true"]'));
  const own = await deployFirst(page);
  await expect(board(page).locator(`[data-cell="${own.cell}"]`)).toHaveAttribute('data-recent-player', 'A');
  await waitForHumanTurn(page);

  // The bot's cells are marked on the board, and only those.
  const botCell = (await board(page).locator('[data-owner="B"]').getAttribute('data-cell'))!;
  expect(ownTrapCells).toContain(botCell);
  const marked = await cellsOf(board(page).locator('[data-recent="true"]'));
  expect(marked).toEqual([botCell]);
  await expect(board(page).locator(`[data-cell="${botCell}"]`)).toHaveAttribute('data-recent-player', 'B');

  // A toast names the trap trigger, then what the trap did, in that order.
  const trigger = page.locator('[data-testid="toast"][data-kind="trap-triggered"]');
  await expect(trigger).toHaveText(new RegExp(`^Bot's .+ triggered your trap at ${botCell}\\.$`));
  const kinds = await toasts(page).evaluateAll((items) => items.map((item) => item.getAttribute('data-kind')));
  expect(kinds.indexOf('trap-triggered')).toBeLessThan(kinds.findIndex((kind) => kind === 'charge-lost' || kind === 'lock-applied'));
  // The bot's token on the trap shows the lost charge.
  await expect(board(page).locator(`[data-cell="${botCell}"] [data-testid="token"]`)).toHaveAttribute('data-charge', '0');
  await attachScreenshot(page, testInfo, 'event-toast');

  // The toast leaves by itself; the board keeps the last move marked until the next action.
  await expect(toasts(page)).toHaveCount(0, { timeout: 10_000 });
  await expect(board(page).locator(`[data-cell="${botCell}"]`)).toHaveAttribute('data-recent', 'true');
});

test('[scenario:how-to-play] How to Play opens from the title and the match menu, explains the game, closes with Escape or its button, and returns focus', async ({ page }) => {
  await openTitle(page);
  const dialog = page.getByRole('dialog', { name: 'How to play' });
  const opener = page.getByTestId('title-screen').getByRole('button', { name: 'How to play' });
  await opener.click();
  await expect(dialog).toBeVisible();
  await expect(page.getByRole('button', { name: 'Close How to play' })).toBeFocused();

  // Matching, every fighter and the Square objective.
  await expect(dialog.locator('[data-section="matching"]')).toContainText('same terrain or the same symbol');
  await expect(dialog.getByTestId('matching-example')).toContainText('✓ matches (same terrain)');
  await expect(dialog.getByTestId('matching-example')).toContainText('✗ no match');
  const fighters = dialog.locator('[data-section="fighters"] li[data-fighter]');
  await expect(fighters).toHaveCount(FIGHTERS.length);
  for (const fighter of FIGHTERS) await expect(dialog.locator(`li[data-fighter="${fighter.type}"]`)).toContainText(fighter.summary);
  await expect(dialog.locator('[data-section="objective"]')).toContainText('Goal: Square');
  await expect(dialog.locator('[data-section="objective"]')).toContainText('2×2');

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

  // From the match menu, closed with its close button; focus returns to the menu's button.
  await openSetup(page, 'Easy');
  await page.getByRole('button', { name: 'Use default setup' }).click();
  await openMenu(page);
  const menuOpener = page.getByTestId('menu-how-to-play');
  await menuOpener.click();
  await expect(dialog).toBeVisible();
  await expect(dialog.locator('[data-section="matching"]')).toBeVisible();
  await attachScreenshot(page, test.info(), 'how-to-play');
  await page.getByRole('button', { name: 'Close How to play' }).click();
  await expect(dialog).toHaveCount(0);
  await expect(menuOpener).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(page.getByTestId('menu-button')).toBeFocused();

  // The goal chip opens it at the objective, and focus comes back to the chip.
  const chip = page.getByTestId('goal-chip');
  await chip.click();
  await expect(dialog.locator('[data-section="objective"]')).toBeInViewport();
  await expect(dialog.locator('.dialog-body')).toHaveAttribute('data-open-section', 'objective');
  await page.keyboard.press('Escape');
  await expect(chip).toBeFocused();
});

test('[scenario:resume-match] after a reload, Continue restores the same board, tokens, charges, constraint and turn', async ({ page }, testInfo) => {
  await startMatch(page, { depth: 'Normal' });
  for (let i = 0; i < 3; i += 1) {
    await waitForHumanTurn(page);
    await playGlowingAction(page);
  }
  await waitForHumanTurn(page);
  expect(await turnNumber(page)).toBe(7);
  const before = await matchSnapshot(page);
  expect(before.tokens.length).toBeGreaterThanOrEqual(4);

  await page.reload();
  const resume = page.getByTestId('continue');
  await expect(resume).toBeVisible();
  await expect(resume).toContainText(`Normal bot, turn ${before.turn}`);
  await resume.click();
  await expect(board(page)).toBeVisible();
  expect(await matchSnapshot(page)).toEqual(before);
  await expect(page.getByTestId('turn')).toHaveText('Your turn');
  // A resumed match starts quiet: no toast from earlier actions.
  await expect(toasts(page)).toHaveCount(0);

  // The restored match goes on: one more action and the bot's reply.
  await playGlowingAction(page);
  await waitForHumanTurn(page);
  expect(await turnNumber(page)).toBe(9);
  await attachScreenshot(page, testInfo, 'resume-match');
});

test('[scenario:full-match] glowing legal actions play a match to its end screen, which is counted in the results', async ({ page }, testInfo) => {
  test.setTimeout(240_000);
  await openTitle(page, FULL_MATCH);
  const easy = page.getByTestId('results').locator('tr[data-depth="easy"]');
  const total = async () =>
    (await Promise.all(['data-wins', 'data-losses', 'data-draws'].map((name) => easy.getAttribute(name)))).reduce((sum, value) => sum + Number(value), 0);
  const before = await total();
  await openSetup(page, 'Easy');
  await page.getByRole('button', { name: 'Use default setup' }).click();
  const end = page.getByTestId('end-screen');

  while (true) {
    await waitForHumanTurn(page);
    if (await end.isVisible()) break;
    const actions = (await turnNumber(page)) - 1;
    if (actions >= MAX_ACTIONS) throw new Error(`The match did not end within ${MAX_ACTIONS} actions.`);
    await playGlowingAction(page);
  }

  // The result, both objectives, both rosters and every trap with its fate.
  const result = (await page.getByTestId('result').textContent())!;
  expect(result).toMatch(/^(You win|The bot wins|Draw)/);
  await expect(page.getByTestId('turn')).toHaveText(result);
  await expect(page.getByTestId('objectives')).toHaveText('Objectives: you Square, bot Square');
  for (const id of ['roster-human', 'roster-bot']) {
    const text = (await page.getByTestId(id).textContent())!;
    expect(text.slice(text.indexOf(':') + 1).split(',').map((name) => name.trim()).filter(Boolean)).toHaveLength(4);
  }
  const traps = page.getByTestId('traps').locator('li');
  expect(await page.getByTestId('traps').locator('li[data-owner="A"]').count()).toBeGreaterThanOrEqual(2);
  expect(await page.getByTestId('traps').locator('li[data-owner="B"]').count()).toBeGreaterThanOrEqual(2);
  for (const trap of await traps.all()) {
    await expect(trap).toHaveAttribute('data-fate', /^(live|triggered|removed)$/);
    const cell = (await trap.getAttribute('data-cell'))!;
    await expect(trap).toHaveText(new RegExp(`at ${cell}: (never triggered|triggered on turn \\d+|removed on turn \\d+)`));
  }
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
  await page.getByRole('button', { name: 'Use default setup' }).click();

  // Mute from the match menu; the setting survives a reload.
  await openMenu(page);
  const sound = page.getByRole('switch', { name: 'Sound' });
  await sound.click();
  await expect(sound).toHaveAttribute('aria-checked', 'false');
  await page.reload();
  await page.getByTestId('continue').click();
  await openMenu(page);
  await expect(page.getByRole('switch', { name: 'Sound' })).toHaveAttribute('aria-checked', 'false');
  await page.keyboard.press('Escape');

  // While muted, a whole turn with the bot's reply and a refusal plays nothing; every event is still shown.
  await deployFirst(page);
  await waitForHumanTurn(page);
  await expect(board(page).locator('[data-owner="B"]')).toHaveCount(1);
  await trayTokens(page).first().click();
  const taken = (await board(page).locator('[data-owner="B"]').getAttribute('data-cell'))!;
  await board(page).locator('[data-owner="B"]').click();
  await expect(page.locator('[data-testid="toast"][data-kind="refusal"]')).toHaveText(new RegExp(`^(${taken} is occupied\\.|.+ does not match .+\\.)$`));
  expect(await audio()).toEqual({ contexts: 0, tones: 0 });
  await attachScreenshot(page, testInfo, 'sound-toggle');

  // Unmuted again in the menu, the next action is heard.
  await openMenu(page);
  await page.getByRole('switch', { name: 'Sound' }).click();
  await page.keyboard.press('Escape');
  await playGlowingAction(page);
  await expect.poll(async () => (await audio()).tones).toBeGreaterThan(0);
});
