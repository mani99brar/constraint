/// <reference lib="dom" />
// The DOM library types the callbacks that run in the page (page.evaluate).
import { expect, test, type Page } from '@playwright/test';
import { FIGHTERS } from '@okiya/content';
import {
  attachScreenshot,
  deployFirst,
  fixRandomness,
  HUMAN_STARTS,
  isEdge,
  matchSnapshot,
  openSetup,
  openTitle,
  playHighlightedAction,
  startMatch,
  waitForHumanTurn,
} from './helpers';

// Randomness is fixed per test through `fixRandomness`; cells and constraints are read from the page.
/** With randomness 5 and the Easy bot, the first-highlighted-action policy ends a match in a few dozen actions. */
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

test('[scenario:title-screen] the title screen offers New game, How to play, results and settings, and no helper anywhere', async ({ page }, testInfo) => {
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
  await expect(results).toContainText('Hard');
  await expect(page.getByRole('switch', { name: 'Move highlights' })).toHaveAttribute('aria-checked', 'true');
  await expect(page.getByRole('switch', { name: 'Sound' })).toHaveAttribute('aria-checked', 'true');
  await expectNoHelpers(page);
  await attachScreenshot(page, testInfo, 'title-screen');

  // Neither New game, setup nor the match shows a seed, preset, scenario or rules-values panel.
  await openSetup(page, 'Normal');
  await expectNoHelpers(page);
  await page.getByRole('button', { name: 'Use default setup' }).click();
  await expect(page.getByTestId('board')).toBeVisible();
  await expect(page.getByTestId('bot-depth')).toHaveText('Bot: Normal');
  await expectNoHelpers(page);
  await page.getByTestId('match-how-to-play').click();
  await expectNoHelpers(page);
});

test('[scenario:setup-flow] New game: a difficulty, four distinct fighters, distinct traps, then start', async ({ page }, testInfo) => {
  await openTitle(page);
  await page.getByRole('button', { name: /^New game/ }).click();
  const difficulties = page.getByTestId('difficulty-screen').locator('button[data-depth]');
  await expect(difficulties).toHaveCount(3);
  await page.getByRole('button', { name: /^Normal\b/ }).click();
  await expect(page.getByTestId('setup-board')).toBeVisible();
  await expect(page.getByTestId('bot-depth')).toHaveText('Bot: Normal');

  const pool = page.getByTestId('pool').getByRole('button');
  const roster = page.getByTestId('roster').getByRole('button');
  const refusal = page.getByTestId('setup-refusal');
  const names = await pool.allTextContents();
  expect(names).toEqual(FIGHTERS.map((fighter) => fighter.name));

  // Two fighters, then a duplicate, which is refused with its reason.
  await pool.nth(0).click();
  await pool.nth(1).click();
  await expect(roster).toHaveCount(2);
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
  const chosen = names.slice(0, 4);

  // The setup traps, on distinct cells of the revealed board.
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
  }
  expect(new Set(trapCells).size).toBe(trapCount);
  await attachScreenshot(page, testInfo, 'setup-flow');
  await page.getByRole('button', { name: 'Start with this setup' }).click();

  // The match shows the chosen roster in reserve and only the player's own traps.
  await expect(page.getByTestId('board')).toBeVisible();
  await expect(page.getByTestId('turn')).toHaveText('Your turn');
  expect((await page.getByTestId('reserve').getByRole('button').allTextContents()).sort()).toEqual([...chosen].sort());
  const board = page.getByTestId('board');
  await expect(board.locator('[data-own-trap="true"]')).toHaveCount(trapCount);
  for (const cell of trapCells) await expect(board.locator(`[data-cell="${cell}"]`)).toHaveAttribute('data-own-trap', 'true');
  await expect(page.getByText(/bot's trap/i)).toHaveCount(0);

  // The default setup starts a match too.
  await page.getByTestId('menu').click();
  await openSetup(page, 'Easy');
  await page.getByRole('button', { name: 'Use default setup' }).click();
  await expect(page.getByTestId('reserve').getByRole('button')).toHaveCount(4);
  await expect(board.locator('[data-own-trap="true"]')).toHaveCount(2);
});

test('[scenario:legal-turn] a deploy on a highlighted edge cell sets the constraint, the bot replies, and a non-matching cell is refused', async ({ page }, testInfo) => {
  await startMatch(page);
  const turn = page.getByTestId('turn');
  const log = page.getByTestId('log').locator('li');
  await expect(turn).toHaveText('Your turn');

  await page.getByTestId('reserve').getByRole('button').first().click();
  const highlighted = page.locator('[data-testid="board"] [data-highlighted="true"]');
  await expect(highlighted.first()).toBeVisible();
  for (const cell of await highlighted.all()) expect(isEdge((await cell.getAttribute('data-cell'))!)).toBe(true);
  const target = highlighted.first();
  const cellId = (await target.getAttribute('data-cell'))!;
  const terrain = (await target.getAttribute('data-terrain'))!;
  const symbol = (await target.getAttribute('data-symbol'))!;
  await target.click();

  const constraint = page.getByTestId('constraint');
  await expect(constraint).toHaveAttribute('data-terrain', terrain);
  await expect(constraint).toHaveAttribute('data-symbol', symbol);
  await expect(constraint).toContainText(`${terrain} or ${symbol}`);
  await expect(page.locator(`[data-testid="board"] [data-cell="${cellId}"]`)).toHaveAttribute('data-owner', 'A');

  // The bot replies with a logged action and hands the turn back.
  await expect(log).toHaveCount(2);
  await expect(log.nth(1)).toHaveAttribute('data-player', 'B');
  await expect(turn).toHaveText('Your turn');
  const turnNumber = await turn.getAttribute('data-turn');

  // A click on an empty cell matching neither attribute of the constraint is refused.
  const currentTerrain = (await constraint.getAttribute('data-terrain'))!;
  const currentSymbol = (await constraint.getAttribute('data-symbol'))!;
  const refusedCell = page
    .locator(`[data-testid="board"] [data-cell][data-occupied="false"]:not([data-terrain="${currentTerrain}"]):not([data-symbol="${currentSymbol}"])`)
    .first();
  await page.getByTestId('reserve').getByRole('button').first().click();
  await expect(refusedCell).toHaveAttribute('data-highlighted', 'false');
  const refusedTerrain = (await refusedCell.getAttribute('data-terrain'))!;
  const refusedSymbol = (await refusedCell.getAttribute('data-symbol'))!;
  await refusedCell.click();

  await expect(page.getByTestId('refusal')).toHaveText(`${refusedTerrain}–${refusedSymbol} does not match ${currentTerrain} or ${currentSymbol}.`);
  await expect(turn).toHaveText('Your turn');
  await expect(turn).toHaveAttribute('data-turn', turnNumber!);
  await expect(log).toHaveCount(2);

  await attachScreenshot(page, testInfo, 'legal-turn');
});

test('[scenario:highlight-toggle] with highlights off nothing is marked, legal moves work, illegal ones are refused, and the setting survives a reload', async ({ page }, testInfo) => {
  await openTitle(page);
  const highlights = page.getByRole('switch', { name: 'Move highlights' });
  await expect(highlights).toHaveAttribute('aria-checked', 'true');
  await highlights.click();
  await expect(highlights).toHaveAttribute('aria-checked', 'false');
  await page.reload();
  await expect(page.getByRole('switch', { name: 'Move highlights' })).toHaveAttribute('aria-checked', 'false');

  await openSetup(page, 'Easy');
  await page.getByRole('button', { name: 'Use default setup' }).click();
  await expect(page.getByTestId('turn')).toHaveText('Your turn');
  const board = page.getByTestId('board');
  const marked = board.locator('[data-highlighted="true"], .cell.highlighted');
  const prompt = page.getByTestId('turn-prompt');

  // The opening: an inner cell is refused with its reason, an edge cell is legal.
  await page.getByTestId('reserve').getByRole('button').first().click();
  await expect(page.getByTestId('actions').getByRole('button').first()).toBeVisible();
  await expect(marked).toHaveCount(0);
  await expect(prompt).not.toContainText('highlighted');
  await expect(prompt).toContainText('Deploy it on an outside-edge cell');
  await board.locator('[data-cell="B2"]').click();
  await expect(page.getByTestId('refusal')).toHaveText('B2 is not on the outside edge; the opening deployment must be.');
  await expect(page.getByTestId('log').locator('li')).toHaveCount(0);
  await board.locator('[data-cell="A1"]').click();
  await expect(board.locator('[data-cell="A1"]')).toHaveAttribute('data-owner', 'A');
  await expect(page.getByTestId('log').locator('li')).toHaveCount(2);
  await waitForHumanTurn(page);

  // Under a constraint: still nothing marked, and a non-matching cell is refused with its reason.
  const constraint = page.getByTestId('constraint');
  const terrain = (await constraint.getAttribute('data-terrain'))!;
  const symbol = (await constraint.getAttribute('data-symbol'))!;
  await page.getByTestId('reserve').getByRole('button').first().click();
  await expect(marked).toHaveCount(0);
  const refused = board.locator(`[data-cell][data-occupied="false"]:not([data-terrain="${terrain}"]):not([data-symbol="${symbol}"])`).first();
  await refused.click();
  await expect(page.getByTestId('refusal')).toContainText(`does not match ${terrain} or ${symbol}.`);
  await expect(page.getByTestId('log').locator('li')).toHaveCount(2);
  await attachScreenshot(page, testInfo, 'highlight-toggle');

  // The setting is still off after a reload.
  await page.reload();
  await expect(page.getByRole('switch', { name: 'Move highlights' })).toHaveAttribute('aria-checked', 'false');
});

test('[scenario:how-to-play] How to Play opens from the title and match screens, explains the game, and returns focus', async ({ page }, testInfo) => {
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
  await attachScreenshot(page, testInfo, 'how-to-play');

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

  // From the match screen, closed with its close button.
  await openSetup(page, 'Easy');
  await page.getByRole('button', { name: 'Use default setup' }).click();
  const matchOpener = page.getByTestId('match-how-to-play');
  await matchOpener.click();
  await expect(dialog).toBeVisible();
  await expect(dialog.locator('[data-section="matching"]')).toBeVisible();
  await page.getByRole('button', { name: 'Close How to play' }).click();
  await expect(dialog).toHaveCount(0);
  await expect(matchOpener).toBeFocused();
});

test('[scenario:turn-feedback] the log, the status line and the board show the action and the reply, and the turn returns', async ({ page }, testInfo) => {
  await startMatch(page);
  const log = page.getByTestId('log').locator('li');
  const turn = page.getByTestId('turn');
  const prompt = page.getByTestId('turn-prompt');
  await expect(turn).toHaveText('Your turn');
  // Nothing is selected: the status line counts every available action.
  await expect(prompt).toContainText(/^You have \d+ legal actions\. Select a fighter/);

  const own = await deployFirst(page);
  await expect(turn).toHaveText("Bot's turn");
  await expect(prompt).toContainText('The bot is thinking');

  // The public log lists both actions in A1–D4 notation.
  await expect(log).toHaveCount(2);
  await expect(turn).toHaveText('Your turn');
  await expect(log.nth(0)).toHaveText(`Turn 1 · You: deploy ${own.name} at ${own.cell}`);
  const botLine = (await log.nth(1).textContent())!;
  const botMatch = /^Turn 2 · Bot: deploy (.+) at ([A-D][1-4])$/.exec(botLine);
  expect(botMatch, botLine).not.toBeNull();
  const board = page.getByTestId('board');
  await expect(board.locator(`[data-cell="${own.cell}"]`)).toHaveAttribute('data-owner', 'A');
  const botCell = board.locator(`[data-cell="${botMatch![2]}"]`);
  await expect(botCell).toHaveAttribute('data-owner', 'B');
  await expect(botCell).toHaveAttribute('data-recent', 'true');

  // The resolution lists both actions step by step; the status line and panel follow.
  const resolution = page.getByTestId('resolution');
  await expect(resolution).toContainText(`Your ${own.name} deployed at ${own.cell}.`);
  await expect(resolution).toContainText(`Bot's ${botMatch![1]} deployed at ${botMatch![2]}.`);
  await expect(resolution).toContainText('Constraint is now');
  const constraint = page.getByTestId('constraint');
  await expect(constraint).toHaveAttribute('data-terrain', (await botCell.getAttribute('data-terrain'))!);
  await expect(constraint).toHaveAttribute('data-symbol', (await botCell.getAttribute('data-symbol'))!);
  await expect(turn).toHaveAttribute('data-turn', '3');
  await expect(prompt).toContainText(/^You have \d+ legal actions?\. Select a fighter, then a highlighted cell matching/);
  await expect(page.getByTestId('recharges')).toContainText('you 3, bot 3');
  await expect(page.getByTestId('deployed')).toHaveAttribute('data-a', '1');
  await expect(page.getByTestId('deployed')).toHaveAttribute('data-b', '1');
  const charges = page.getByTestId('charges').locator('li');
  await expect(charges).toHaveCount(2);
  await expect(charges.filter({ hasText: new RegExp(`^You: ${own.name} at ${own.cell}, (charged|spent)`) })).toHaveCount(1);
  await expect(charges.filter({ hasText: new RegExp(`^Bot: ${botMatch![1]} at ${botMatch![2]}, (charged|spent)`) })).toHaveCount(1);

  await attachScreenshot(page, testInfo, 'turn-feedback');
});

test('[scenario:action-feedback] the bot’s reply enters a player trap, and the board highlights it and calls the trap out', async ({ page }, testInfo) => {
  // Randomness 1 fixes the board, the player's default traps and the bot's private setup, so the
  // Easy bot's first reply enters one of the player's setup traps.
  await startMatch(page, { seed: HUMAN_STARTS, depth: 'Easy' });
  await expect(page.getByTestId('turn')).toHaveText('Your turn');
  const log = page.getByTestId('log').locator('li');
  const board = page.getByTestId('board');
  const ownTrapCells = await board.locator('[data-own-trap="true"]').evaluateAll((cells) => cells.map((cell) => cell.getAttribute('data-cell')));
  await deployFirst(page);
  await expect(log).toHaveCount(2);
  await waitForHumanTurn(page);

  // The cells the bot's action involved are highlighted, and only those.
  const botLine = (await log.nth(1).textContent())!;
  const botCell = /([A-D][1-4])$/.exec(botLine)![1]!;
  await expect(board.locator(`[data-cell="${botCell}"]`)).toHaveAttribute('data-recent', 'true');
  await expect(board.locator(`[data-cell="${botCell}"]`)).toHaveAttribute('data-recent-player', 'B');
  const botResolution = (await page.getByTestId('resolution').locator('[data-player="B"]').textContent())!;
  for (const cell of await board.locator('[data-recent="true"]').evaluateAll((cells) => cells.map((cell) => cell.getAttribute('data-cell')!))) {
    expect(botResolution).toContain(cell);
  }

  // The trap trigger is called out on its cell.
  expect(ownTrapCells).toContain(botCell);
  await expect(page.getByTestId('resolution')).toContainText(`triggered your trap at ${botCell}`);
  const callout = board.locator(`[data-testid="trap-callout"][data-callout-cell="${botCell}"]`);
  await expect(callout).toBeVisible();
  await expect(callout).toHaveText(/^Trap: (charge lost|locked)$/);

  await attachScreenshot(page, testInfo, 'action-feedback');

  // The highlight and the callout clear after the player's next action.
  const botTurn = (await log.nth(1).getAttribute('data-turn')) ?? '2';
  await deployFirst(page);
  await expect(log.nth(2)).toHaveAttribute('data-player', 'A');
  await expect(board.locator(`[data-recent-turn="${botTurn}"]`)).toHaveCount(0);
  await expect(callout).toHaveCount(0);
});

test('[scenario:resume-match] after a reload, Continue restores the same board, fighters, charges, constraint and turn', async ({ page }, testInfo) => {
  await startMatch(page, { depth: 'Normal' });
  for (let i = 0; i < 3; i += 1) {
    await waitForHumanTurn(page);
    await playHighlightedAction(page);
  }
  await waitForHumanTurn(page);
  await expect(page.getByTestId('log').locator('li')).toHaveCount(6);
  const before = await matchSnapshot(page);
  expect(before.tokens.length).toBeGreaterThanOrEqual(4);

  await page.reload();
  const resume = page.getByTestId('continue');
  await expect(resume).toBeVisible();
  await expect(resume).toContainText(`Normal bot, turn ${before.turn}`);
  await resume.click();
  await expect(page.getByTestId('board')).toBeVisible();
  await expect(page.getByTestId('bot-depth')).toHaveText('Bot: Normal');
  expect(await matchSnapshot(page)).toEqual(before);
  await expect(page.getByTestId('turn')).toHaveText('Your turn');

  // The restored match goes on: one more action and the bot's reply.
  await playHighlightedAction(page);
  await expect(page.getByTestId('log').locator('li')).toHaveCount(8);
  await attachScreenshot(page, testInfo, 'resume-match');
});

test('[scenario:full-match] a match is played to its end screen and counted in the results', async ({ page }, testInfo) => {
  test.setTimeout(240_000);
  await openTitle(page, FULL_MATCH);
  const easy = page.getByTestId('results').locator('tr[data-depth="easy"]');
  const total = async () =>
    (await Promise.all(['data-wins', 'data-losses', 'data-draws'].map((name) => easy.getAttribute(name)))).reduce((sum, value) => sum + Number(value), 0);
  const before = await total();
  await openSetup(page, 'Easy');
  await page.getByRole('button', { name: 'Use default setup' }).click();
  const end = page.getByTestId('end-screen');
  const log = page.getByTestId('log').locator('li');

  while (true) {
    await waitForHumanTurn(page);
    if (await end.isVisible()) break;
    const actions = await log.count();
    if (actions >= MAX_ACTIONS) throw new Error(`The match did not end within ${MAX_ACTIONS} actions.`);
    await playHighlightedAction(page);
  }

  // The result, both objectives, both rosters and every trap with its fate.
  const result = (await page.getByTestId('result').textContent())!;
  expect(result).toMatch(/^(You win|The bot wins|Draw)/);
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
  await expect(page.getByTestId('turn-prompt')).toHaveText('The match is over.');
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

test('[scenario:sound-toggle] sound starts only after a user action, and muting persists and silences it', async ({ page }, testInfo) => {
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

  // Mute on the title screen; the setting survives a reload.
  await page.getByRole('button', { name: 'Back' }).click();
  await page.getByRole('button', { name: 'Back' }).click();
  const sound = page.getByRole('switch', { name: 'Sound' });
  await sound.click();
  await expect(sound).toHaveAttribute('aria-checked', 'false');
  await page.reload();
  await expect(page.getByRole('switch', { name: 'Sound' })).toHaveAttribute('aria-checked', 'false');

  // While muted, a whole turn with the bot's reply plays nothing, and every event is still shown.
  await openSetup(page, 'Easy');
  await page.getByRole('button', { name: 'Use default setup' }).click();
  await deployFirst(page);
  await expect(page.getByTestId('log').locator('li')).toHaveCount(2);
  await waitForHumanTurn(page);
  await page.getByTestId('board').locator('[data-cell="B2"][data-occupied="false"], [data-cell="C3"][data-occupied="false"]').first().click();
  expect(await audio()).toEqual({ contexts: 0, tones: 0 });
  await attachScreenshot(page, testInfo, 'sound-toggle');

  // Unmuted again from the match screen, the next action is heard.
  await page.getByRole('switch', { name: 'Sound' }).click();
  await playHighlightedAction(page);
  await expect.poll(async () => (await audio()).tones).toBeGreaterThan(0);
});
