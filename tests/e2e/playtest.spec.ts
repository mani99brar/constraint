/// <reference lib="dom" />
// The DOM library types the callbacks that run in the page (page.evaluate).
import { expect, test, type Page } from '@playwright/test';
import { attachScreenshot, boardTiles, deployFirst, openSetup, startFromLanding, startMatch, waitForHumanTurn } from './helpers';

// Seeds are the only hardcoded values; cells and constraints are read from the page.
/** With seed 1 the human opens. */
const HUMAN_STARTS_SEED = 1;
/** With seed 3 under spec-v0.2, the first-highlighted-action policy below ends a match in a few dozen actions. */
const FULL_MATCH_SEED = 3;
/** With seed 6 and the default setup, the bot's first reply enters one of the human's setup traps. */
const BOT_ENTERS_TRAP_SEED = 6;
const MAX_ACTIONS = 200;

test('[scenario:preset-and-scenario] the player chooses a preset and the paper test 01 scenario', async ({ page }, testInfo) => {
  // The preset spec-v0.2-two-displacers, and how it differs from spec-v0.2.
  await page.goto(`/?seed=${HUMAN_STARTS_SEED}`);
  const presets = page.getByTestId('preset-choices').getByRole('radio');
  expect(await presets.count()).toBeGreaterThanOrEqual(2);
  await expect(page.getByTestId('differences-spec-v0.2-two-displacers')).toContainText(
    'Displacers per roster: at most 2 (spec-v0.2: no limit).',
  );
  await openSetup(page, { seed: HUMAN_STARTS_SEED, preset: 'spec-v0.2-two-displacers' });
  await expect(page.getByTestId('preset')).toHaveAttribute('data-preset', 'spec-v0.2-two-displacers');
  await expect(page.getByTestId('preset')).toContainText('Displacers per roster: at most 2');

  // A third displacer is refused with its reason.
  const displacers = page.getByTestId('pool').locator('button[data-displacer="true"]');
  expect(await displacers.count()).toBeGreaterThanOrEqual(3);
  const roster = page.getByTestId('roster').getByRole('button');
  await displacers.nth(0).click();
  await displacers.nth(1).click();
  await expect(roster).toHaveCount(2);
  await displacers.nth(2).click();
  await expect(page.getByTestId('setup-refusal')).toHaveText(
    'At most 2 displacers (Pusher, Puller, Swapper) are allowed; this roster has 3.',
  );
  await expect(roster).toHaveCount(2);
  await expect(displacers.nth(2)).toHaveAttribute('aria-pressed', 'false');

  // The paper test 01 scenario: its fixed board, whatever the seed, and A to move.
  await page.getByRole('button', { name: 'Back' }).click();
  await startFromLanding(page, { seed: HUMAN_STARTS_SEED, scenario: 'paper-test-01' });
  const board = page.getByTestId('board');
  await expect(board).toBeVisible();
  await expect(page.getByTestId('setup-board')).toHaveCount(0);
  await expect(page.getByTestId('scenario')).toContainText('Paper test 01 fixture');
  const fixture = await boardTiles(board);

  await page.getByRole('button', { name: 'New match' }).click();
  await startFromLanding(page, { seed: HUMAN_STARTS_SEED + 1, scenario: 'paper-test-01' });
  await expect(board).toBeVisible();
  expect(await boardTiles(board)).toEqual(fixture);

  await page.getByRole('button', { name: 'New match' }).click();
  await startMatch(page, { seed: HUMAN_STARTS_SEED + 1 });
  expect(await boardTiles(board)).not.toEqual(fixture);

  await page.getByRole('button', { name: 'New match' }).click();
  await startFromLanding(page, { seed: HUMAN_STARTS_SEED, scenario: 'paper-test-01' });
  const turn = page.getByTestId('turn');
  await expect(turn).toHaveText('Your turn');
  await expect(turn).toHaveAttribute('data-active', 'A');
  await expect(page.getByTestId('turn-bar')).toContainText('You are A');
  await expect(page.getByTestId('log').locator('li')).toHaveCount(0);
  await expect(page.getByTestId('reserve').getByRole('button')).toHaveCount(4);
  await expect(board.locator('[data-own-trap="true"]')).toHaveCount(2);

  await attachScreenshot(page, testInfo, 'preset-and-scenario');
});

/** Plays one human action: the first fighter with legal actions, then its first highlighted cell. */
async function playHighlightedAction(page: Page) {
  const log = page.getByTestId('log').locator('li');
  const before = await log.count();
  await page.locator('[data-testid="reserve"], [data-testid="on-board"]').locator('button[data-has-actions="true"]').first().click();
  const highlighted = page.locator('[data-testid="board"] [data-highlighted="true"]');
  if ((await highlighted.count()) > 0) {
    await highlighted.first().click();
  } else {
    await page.getByTestId('actions').getByRole('button').first().click();
  }
  const chooser = page.getByTestId('chooser');
  await expect.poll(async () => (await log.count()) > before || (await chooser.isVisible())).toBe(true);
  if ((await log.count()) === before) await chooser.getByRole('button').first().click();
  await expect.poll(() => log.count()).toBeGreaterThan(before);
}

test('[scenario:full-match] a match under spec-v0.2 is played to its end screen', async ({ page }, testInfo) => {
  test.setTimeout(240_000);
  await startMatch(page, { seed: FULL_MATCH_SEED, depth: 'Easy' });
  await expect(page.getByTestId('preset')).toHaveAttribute('data-preset', 'spec-v0.2');
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
  await expect(page.getByTestId('result')).toHaveText(/^(You win|The bot wins|Draw)/);
  await expect(page.getByTestId('objectives')).toHaveText('Objectives: you Square, bot Square');
  for (const id of ['roster-human', 'roster-bot']) {
    const text = (await page.getByTestId(id).textContent())!;
    expect(text.slice(text.indexOf(':') + 1).split(',').map((name) => name.trim()).filter(Boolean)).toHaveLength(4);
  }
  const traps = page.getByTestId('traps').locator('li');
  expect(await traps.count()).toBeGreaterThanOrEqual(4);
  expect(await page.getByTestId('traps').locator('li[data-owner="A"]').count()).toBeGreaterThanOrEqual(2);
  expect(await page.getByTestId('traps').locator('li[data-owner="B"]').count()).toBeGreaterThanOrEqual(2);
  for (const trap of await traps.all()) {
    await expect(trap).toHaveAttribute('data-fate', /^(live|triggered|removed)$/);
    const cell = (await trap.getAttribute('data-cell'))!;
    await expect(trap).toHaveText(new RegExp(`at ${cell}: (never triggered|triggered on turn \\d+|removed on turn \\d+)`));
  }
  await expect(page.getByTestId('turn-prompt')).toHaveText('The match is over.');

  await attachScreenshot(page, testInfo, 'full-match');
});

test('[scenario:turn-clarity] the screen says whose turn it is, the constraint and what the player can do', async ({ page }, testInfo) => {
  await startMatch(page, { seed: HUMAN_STARTS_SEED });
  const turn = page.getByTestId('turn');
  const prompt = page.getByTestId('turn-prompt');
  const reserve = page.getByTestId('reserve').getByRole('button');

  // The player's opening turn.
  await expect(turn).toHaveText('Your turn');
  await expect(page.getByTestId('constraint')).toContainText('outside-edge');
  const selectedName = (await reserve.first().textContent())!;
  const highlightedCount = await page.locator('[data-testid="board"] [data-highlighted="true"]').count();
  expect(highlightedCount).toBeGreaterThan(0);
  await expect(prompt).toContainText(`${selectedName} selected: ${highlightedCount} legal action`);

  // During the bot's turn the controls are disabled and the screen says the bot is thinking.
  await deployFirst(page);
  await expect(turn).toHaveText("Bot's turn");
  await expect(prompt).toContainText('The bot is thinking');
  await expect(reserve.first()).toBeDisabled();
  await expect(page.getByTestId('board')).toHaveAttribute('aria-disabled', 'true');
  await expect(page.getByTestId('actions')).toHaveCount(0);

  // Back on the player's turn: the constraint in words and the number of actions now.
  await expect(turn).toHaveText('Your turn');
  const constraint = page.getByTestId('constraint');
  const terrain = (await constraint.getAttribute('data-terrain'))!;
  const symbol = (await constraint.getAttribute('data-symbol'))!;
  await expect(constraint).toHaveText(`Constraint: ${terrain} or ${symbol}`);
  await expect(reserve.first()).toBeEnabled();
  await expect(prompt).toContainText(/selected: \d+ legal actions?\./);
  await expect(prompt).toContainText(`matching ${terrain} or ${symbol}`);

  await attachScreenshot(page, testInfo, 'turn-clarity');
});

test('[scenario:action-feedback] the bot’s reply is highlighted on the board with its trap trigger', async ({ page }, testInfo) => {
  await startMatch(page, { seed: BOT_ENTERS_TRAP_SEED });
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
  const recent = board.locator('[data-recent="true"]');
  await expect(board.locator(`[data-cell="${botCell}"]`)).toHaveAttribute('data-recent', 'true');
  await expect(board.locator(`[data-cell="${botCell}"]`)).toHaveAttribute('data-recent-player', 'B');
  const botResolution = (await page.getByTestId('resolution').locator('[data-player="B"]').textContent())!;
  for (const cell of await recent.evaluateAll((cells) => cells.map((cell) => cell.getAttribute('data-cell')!))) {
    expect(botResolution).toContain(cell);
  }

  // The trap trigger is called out on its cell (this seed's bot reply enters a setup trap).
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

test('[scenario:onboarding-guide] a first-visit guide can be dismissed and reopened', async ({ page }, testInfo) => {
  await page.goto(`/?seed=${HUMAN_STARTS_SEED}`);
  const guide = page.getByTestId('guide');
  await expect(guide).toBeVisible();
  await expect(guide.locator('[data-step="matching"]')).toContainText('terrain or that symbol');
  await expect(guide.locator('[data-step="fighters"]')).toContainText('fighters');
  await expect(guide.locator('[data-step="objective"]')).toContainText('Objective: Square');
  await expect(guide.locator('[data-step="objective"]')).toContainText('2×2');

  // It stays open, in context, into the match.
  await startMatch(page, { seed: HUMAN_STARTS_SEED });
  await expect(guide).toBeVisible();
  await attachScreenshot(page, testInfo, 'onboarding-guide');

  await guide.getByRole('button', { name: /hide the guide/ }).click();
  await expect(guide).toHaveCount(0);
  await page.reload();
  await expect(page.getByRole('button', { name: 'Start match' })).toBeVisible();
  await expect(guide).toHaveCount(0);

  await page.getByRole('button', { name: 'Help' }).click();
  await expect(guide).toBeVisible();
  await expect(guide.locator('[data-step="matching"]')).toBeVisible();
});

/** Every visible text element whose contrast against its effective background is below 4.5:1. */
async function lowContrastText(page: Page): Promise<string[]> {
  return page.evaluate(() => {
    const parse = (value: string) => {
      const parts = value.match(/[\d.]+/g)?.map(Number) ?? [0, 0, 0, 0];
      return { r: parts[0]!, g: parts[1]!, b: parts[2]!, a: parts.length > 3 ? parts[3]! : 1 };
    };
    const channel = (c: number) => {
      const v = c / 255;
      return v <= 0.039_28 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
    };
    const luminance = ({ r, g, b }: { r: number; g: number; b: number }) => 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
    const background = (element: Element | null) => {
      for (let node = element; node; node = node.parentElement) {
        const color = parse(getComputedStyle(node).backgroundColor);
        if (color.a > 0) return color;
      }
      return { r: 255, g: 255, b: 255, a: 1 };
    };
    const failures: string[] = [];
    for (const element of document.body.querySelectorAll('*')) {
      const ownText = [...element.childNodes].some((node) => node.nodeType === Node.TEXT_NODE && node.textContent!.trim() !== '');
      if (!ownText) continue;
      const style = getComputedStyle(element);
      const rect = element.getBoundingClientRect();
      if (style.visibility === 'hidden' || rect.width === 0 || rect.height === 0) continue;
      const fg = luminance(parse(style.color));
      const bg = luminance(background(element));
      const ratio = (Math.max(fg, bg) + 0.05) / (Math.min(fg, bg) + 0.05);
      if (ratio < 4.5) failures.push(`${element.tagName}.${element.className} "${element.textContent!.trim().slice(0, 30)}": ${ratio.toFixed(2)}`);
    }
    return failures;
  });
}

test.describe('dark colour scheme', () => {
  test.use({ colorScheme: 'dark' });

  test('[scenario:dark-theme] the board, tokens and text stay distinguishable and readable in dark', async ({ page }, testInfo) => {
    await page.goto(`/?seed=${HUMAN_STARTS_SEED}`);
    expect(await lowContrastText(page)).toEqual([]);
    await startMatch(page, { seed: HUMAN_STARTS_SEED });
    await deployFirst(page);
    await expect(page.getByTestId('log').locator('li')).toHaveCount(2);
    await waitForHumanTurn(page);

    // The dark set is in use.
    const pageBackground = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
    const [r, g, b] = pageBackground.match(/\d+/g)!.map(Number);
    expect(r! + g! + b!).toBeLessThan(120);

    // Four terrains, each with its own colour, shape and label; four symbols with their own shape and label.
    const cells = page.getByTestId('board').locator('[data-cell]');
    const terrains = await cells.evaluateAll((elements) =>
      elements.map((cell) => ({
        terrain: cell.getAttribute('data-terrain')!,
        symbol: cell.getAttribute('data-symbol')!,
        colour: getComputedStyle(cell).backgroundColor,
        terrainShape: cell.querySelector('.terrain svg')!.getAttribute('data-shape'),
        terrainLabel: cell.querySelector('.terrain')!.textContent,
        symbolShape: cell.querySelector('.symbol svg')!.getAttribute('data-shape'),
        symbolLabel: cell.querySelector('.symbol')!.textContent,
      })),
    );
    const byTerrain = new Map(terrains.map((cell) => [cell.terrain, cell]));
    expect(byTerrain.size).toBe(4);
    expect(new Set([...byTerrain.values()].map((cell) => cell.colour)).size).toBe(4);
    expect(new Set([...byTerrain.values()].map((cell) => cell.terrainShape)).size).toBe(4);
    for (const cell of terrains) {
      expect(cell.terrainLabel).toBe(cell.terrain);
      expect(cell.symbolLabel).toBe(cell.symbol);
    }
    expect(new Set(terrains.map((cell) => cell.symbolShape)).size).toBe(4);

    // Your tokens and the bot's differ in shape, colour and label.
    const tokens = await page.getByTestId('board').locator('.token').evaluateAll((elements) =>
      elements.map((token) => ({
        own: token.classList.contains('own'),
        shape: token.querySelector('.token-badge')!.getAttribute('data-shape'),
        colour: getComputedStyle(token.querySelector('.token-badge')!).backgroundColor,
        label: token.querySelector('.token-side')!.firstChild!.textContent,
      })),
    );
    const own = tokens.find((token) => token.own)!;
    const enemy = tokens.find((token) => !token.own)!;
    expect(own.shape).not.toBe(enemy.shape);
    expect(own.colour).not.toBe(enemy.colour);
    expect([own.label, enemy.label]).toEqual(['You', 'Bot']);

    // All text meets 4.5:1 against its background.
    expect(await lowContrastText(page)).toEqual([]);

    await attachScreenshot(page, testInfo, 'dark-theme');
  });
});

/** Every button and board cell smaller than 44 px in either dimension. */
async function smallTargets(page: Page): Promise<string[]> {
  return page.locator('button, [role="gridcell"]').evaluateAll((elements) =>
    elements.flatMap((element) => {
      const rect = element.getBoundingClientRect();
      if (rect.width === 0 && rect.height === 0) return [];
      return rect.width < 44 || rect.height < 44 ? [`${element.textContent!.trim().slice(0, 20)}: ${rect.width}×${rect.height}`] : [];
    }),
  );
}

async function horizontalOverflow(page: Page): Promise<number> {
  return page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
}

test.describe('phone viewport', () => {
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });

  test('[scenario:phone-layout] the board, constraint and controls fit a 390 px phone', async ({ page }, testInfo) => {
    await page.goto(`/?seed=${HUMAN_STARTS_SEED}`);
    expect(await horizontalOverflow(page)).toBeLessThanOrEqual(0);
    expect(await smallTargets(page)).toEqual([]);

    await openSetup(page, { seed: HUMAN_STARTS_SEED });
    expect(await horizontalOverflow(page)).toBeLessThanOrEqual(0);
    expect(await smallTargets(page)).toEqual([]);
    await page.getByRole('button', { name: 'Use default setup' }).tap();
    await expect(page.getByTestId('board')).toBeVisible();

    // Play a turn by touch so the constraint is set and both sides have a token.
    await page.getByTestId('reserve').getByRole('button').first().tap();
    await page.locator('[data-testid="board"] [data-highlighted="true"]').first().tap();
    await expect(page.getByTestId('log').locator('li')).toHaveCount(2);
    await waitForHumanTurn(page);

    expect(await horizontalOverflow(page)).toBeLessThanOrEqual(0);
    const width = page.viewportSize()!.width;
    for (const testId of ['board', 'constraint', 'turn-prompt', 'actions', 'reserve']) {
      const box = (await page.getByTestId(testId).boundingBox())!;
      expect(box.x, testId).toBeGreaterThanOrEqual(0);
      expect(box.x + box.width, testId).toBeLessThanOrEqual(width);
    }
    expect(await smallTargets(page)).toEqual([]);

    await attachScreenshot(page, testInfo, 'phone-layout');
  });
});

/** Presses Tab (or Shift+Tab) until the focused element matches the selector. */
async function tabTo(page: Page, selector: string, backwards = false) {
  for (let i = 0; i < 80; i += 1) {
    if (await page.evaluate((s) => document.activeElement?.matches(s) ?? false, selector)) return;
    await page.keyboard.press(backwards ? 'Shift+Tab' : 'Tab');
  }
  throw new Error(`Tab never reached ${selector}`);
}

const focusedCell = (page: Page) => page.evaluate(() => document.activeElement?.getAttribute('data-cell') ?? null);

test('[scenario:keyboard-play] the player deploys a reserve fighter using the keyboard only', async ({ page }, testInfo) => {
  await startMatch(page, { seed: HUMAN_STARTS_SEED });
  await expect(page.getByTestId('turn')).toHaveText('Your turn');

  // Select the second reserve fighter with Tab and Space.
  const second = page.getByTestId('reserve').getByRole('button').nth(1);
  const fighter = (await second.getAttribute('data-fighter'))!;
  const name = (await second.textContent())!;
  await tabTo(page, `[data-testid="reserve"] button[data-fighter="${fighter}"]`);
  await page.keyboard.press('Space');
  await expect(second).toHaveAttribute('aria-pressed', 'true');

  // Into the board, then around it: arrow keys never leave the 4×4 grid.
  await tabTo(page, '[data-testid="board"] [data-cell]', true);
  for (let i = 0; i < 5; i += 1) await page.keyboard.press('ArrowUp');
  for (let i = 0; i < 5; i += 1) await page.keyboard.press('ArrowLeft');
  expect(await focusedCell(page)).toBe('A1');
  for (let i = 0; i < 5; i += 1) await page.keyboard.press('ArrowRight');
  for (let i = 0; i < 5; i += 1) await page.keyboard.press('ArrowDown');
  expect(await focusedCell(page)).toBe('D4');
  await page.keyboard.press('Home');
  expect(await focusedCell(page)).toBe('A1');

  // Walk to a highlighted cell and deploy there with Enter.
  const target = page.locator('[data-testid="board"] [data-highlighted="true"]').last();
  const cell = (await target.getAttribute('data-cell'))!;
  const row = Number(await target.getAttribute('data-row'));
  const column = Number(await target.getAttribute('data-column'));
  for (let i = 0; i < row; i += 1) await page.keyboard.press('ArrowDown');
  for (let i = 0; i < column; i += 1) await page.keyboard.press('ArrowRight');
  expect(await focusedCell(page)).toBe(cell);
  await page.keyboard.press('Enter');

  await expect(page.locator(`[data-testid="board"] [data-cell="${cell}"]`)).toHaveAttribute('data-owner', 'A');
  await expect(page.getByTestId('log').locator('li').first()).toHaveText(`Turn 1 · You: deploy ${name} at ${cell}`);
  await expect(page.getByTestId('log').locator('li')).toHaveCount(2);

  await attachScreenshot(page, testInfo, 'keyboard-play');
});
