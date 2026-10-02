import { expect, test, type Page, type TestInfo } from '@playwright/test';

// The seed only fixes who starts: with seed 1 the human opens. Everything else is read from the page.
const HUMAN_STARTS_SEED = 1;

async function attachScreenshot(page: Page, testInfo: TestInfo, id: string) {
  const path = testInfo.outputPath(`${id}.png`);
  await page.screenshot({ path, fullPage: true });
  await testInfo.attach(`screenshot:${id}`, { path, contentType: 'image/png' });
}

/** Opens the setup screen of a match; every match starts there. */
async function openSetup(page: Page) {
  await page.goto(`/?seed=${HUMAN_STARTS_SEED}`);
  await page.getByRole('button', { name: 'Start match' }).click();
  await expect(page.getByTestId('setup-board')).toBeVisible();
}

/** Starts a match through the setup screen's "Use default setup" button. */
async function startMatch(page: Page) {
  await openSetup(page);
  await page.getByRole('button', { name: 'Use default setup' }).click();
  await expect(page.getByTestId('board')).toBeVisible();
}

const isEdge = (cell: string) => /^[AD]/.test(cell) || /[14]$/.test(cell);

/** Deploys the first reserve fighter onto the first highlighted cell; returns the cell and the fighter's name. */
async function deployFirst(page: Page) {
  const button = page.getByTestId('reserve').getByRole('button').first();
  const name = (await button.textContent())!;
  await button.click();
  const target = page.locator('[data-cell][data-highlighted="true"]').first();
  await expect(target).toBeVisible();
  const cell = (await target.getAttribute('data-cell'))!;
  await target.click();
  return { cell, name };
}

test('[scenario:start-match] the landing page starts a match against the bot', async ({ page }, testInfo) => {
  await startMatch(page);

  const cells = page.getByTestId('board').locator('[data-cell]');
  await expect(cells).toHaveCount(16);
  const pairs = new Set<string>();
  for (const cell of await cells.all()) {
    const terrain = await cell.getAttribute('data-terrain');
    const symbol = await cell.getAttribute('data-symbol');
    await expect(cell).toContainText(terrain!);
    await expect(cell).toContainText(symbol!);
    pairs.add(`${terrain}-${symbol}`);
  }
  expect(pairs.size).toBe(16);

  const constraint = page.getByTestId('constraint');
  await expect(constraint).toHaveAttribute('data-opening', 'true');
  await expect(constraint).toContainText('outside-edge');
  await expect(page.getByTestId('turn')).toHaveText('Your turn');
  await expect(page.getByTestId('seed')).toContainText(String(HUMAN_STARTS_SEED));

  await attachScreenshot(page, testInfo, 'start-match');
});

test('[scenario:legal-turn] the player deploys on a highlighted edge cell and the bot replies', async ({ page }, testInfo) => {
  await startMatch(page);
  const turn = page.getByTestId('turn');
  const log = page.getByTestId('log').locator('li');
  await expect(turn).toHaveText('Your turn');

  // Deploy the first reserve fighter onto a highlighted edge cell.
  await page.getByTestId('reserve').getByRole('button').first().click();
  const highlighted = page.locator('[data-cell][data-highlighted="true"]');
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
  await expect(page.locator(`[data-cell="${cellId}"]`)).toHaveAttribute('data-owner', 'A');

  // The bot replies with a logged action and hands the turn back.
  await expect(log).toHaveCount(2);
  await expect(log.nth(1)).toHaveAttribute('data-player', 'B');
  await expect(turn).toHaveText('Your turn');
  const turnNumber = await turn.getAttribute('data-turn');

  // A click on an empty cell matching neither attribute of the constraint is refused.
  const currentTerrain = (await constraint.getAttribute('data-terrain'))!;
  const currentSymbol = (await constraint.getAttribute('data-symbol'))!;
  const nonMatching = page.locator(
    `[data-cell][data-occupied="false"]:not([data-terrain="${currentTerrain}"]):not([data-symbol="${currentSymbol}"])`,
  );
  const refusedCell = nonMatching.first();
  await page.getByTestId('reserve').getByRole('button').first().click();
  await expect(refusedCell).toHaveAttribute('data-highlighted', 'false');
  const refusedTerrain = (await refusedCell.getAttribute('data-terrain'))!;
  const refusedSymbol = (await refusedCell.getAttribute('data-symbol'))!;
  await refusedCell.click();

  await expect(page.getByTestId('refusal')).toHaveText(
    `${refusedTerrain}–${refusedSymbol} does not match ${currentTerrain} or ${currentSymbol}.`,
  );
  await expect(turn).toHaveText('Your turn');
  await expect(turn).toHaveAttribute('data-turn', turnNumber!);
  await expect(log).toHaveCount(2);

  await attachScreenshot(page, testInfo, 'legal-turn');
});

test('[scenario:setup-flow] the player picks a roster, places traps and starts', async ({ page }, testInfo) => {
  await openSetup(page);
  const pool = page.getByTestId('pool').getByRole('button');
  const roster = page.getByTestId('roster').getByRole('button');
  const refusal = page.getByTestId('setup-refusal');
  const names = await pool.allTextContents();
  expect(names.length).toBeGreaterThan(4);

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

  // The preset's setup traps, on distinct cells of the revealed board.
  const trapCount = Number(await page.getByTestId('trap-count').textContent());
  expect(trapCount).toBeGreaterThan(0);
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
  await page.getByRole('button', { name: 'Start with this setup' }).click();

  // The match shows the chosen roster in reserve and only the player's own traps.
  await expect(page.getByTestId('board')).toBeVisible();
  await expect(page.getByTestId('turn')).toHaveText('Your turn');
  expect((await page.getByTestId('reserve').getByRole('button').allTextContents()).sort()).toEqual([...chosen].sort());
  const marked = page.getByTestId('board').locator('[data-own-trap="true"]');
  await expect(marked).toHaveCount(trapCount);
  for (const cell of trapCells) {
    await expect(page.getByTestId('board').locator(`[data-cell="${cell}"]`)).toHaveAttribute('data-own-trap', 'true');
  }
  await expect(page.getByTestId('board').locator('.trap')).toHaveCount(trapCount);
  await expect(page.getByText(/bot's trap/i)).toHaveCount(0);

  await attachScreenshot(page, testInfo, 'setup-flow');
});

test('[scenario:turn-feedback] the log, status panel and rules panel follow a turn and the reply', async ({ page }, testInfo) => {
  await startMatch(page);
  const log = page.getByTestId('log').locator('li');
  await expect(page.getByTestId('turn')).toHaveText('Your turn');
  const own = await deployFirst(page);

  // The public log lists both actions in A1–D4 notation.
  await expect(log).toHaveCount(2);
  await expect(page.getByTestId('turn')).toHaveText('Your turn');
  await expect(log.nth(0)).toHaveText(`Turn 1 · You: deploy ${own.name} at ${own.cell}`);
  const botLine = (await log.nth(1).textContent())!;
  const botMatch = /^Turn 2 · Bot: deploy (.+) at ([A-D][1-4])$/.exec(botLine);
  expect(botMatch, botLine).not.toBeNull();
  const botCell = page.getByTestId('board').locator(`[data-cell="${botMatch![2]}"]`);
  await expect(botCell).toHaveAttribute('data-owner', 'B');

  // The resolution feedback lists the bot's reply step by step.
  const resolution = page.getByTestId('resolution');
  await expect(resolution).toContainText(`Bot's ${botMatch![1]} deployed at ${botMatch![2]}.`);

  // The status panel: charges, recharge budgets, deployed counts and the constraint.
  const rules = page.getByTestId('rules');
  const rechargeRule = (await rules.locator('[data-rule="Recharge actions per player"] dd').textContent())!;
  await expect(page.getByTestId('recharges')).toHaveAttribute('data-a', rechargeRule);
  await expect(page.getByTestId('recharges')).toHaveAttribute('data-b', rechargeRule);
  await expect(page.getByTestId('recharges')).toContainText(`you ${rechargeRule}, bot ${rechargeRule}`);
  await expect(page.getByTestId('deployed')).toHaveAttribute('data-a', '1');
  await expect(page.getByTestId('deployed')).toHaveAttribute('data-b', '1');
  const charges = page.getByTestId('charges').locator('li');
  await expect(charges).toHaveCount(2);
  // A deploy onto a hidden enemy trap leaves the fighter spent, so either charge state is accepted.
  await expect(charges.filter({ hasText: new RegExp(`^You: ${own.name} at ${own.cell}, (charged|spent)`) })).toHaveCount(1);
  await expect(charges.filter({ hasText: new RegExp(`^Bot: ${botMatch![1]} at ${botMatch![2]}, (charged|spent)`) })).toHaveCount(1);
  const constraint = page.getByTestId('constraint');
  await expect(constraint).toHaveAttribute('data-terrain', (await botCell.getAttribute('data-terrain'))!);
  await expect(constraint).toHaveAttribute('data-symbol', (await botCell.getAttribute('data-symbol'))!);
  await expect(resolution).toContainText('Constraint is now');

  // The rules panel shows the active preset's values.
  const presetId = (await rules.getAttribute('data-preset'))!;
  await expect(page.getByText(`Preset ${presetId}`)).toBeVisible();
  await expect(rules.locator('[data-rule="Preset"] dd')).toContainText(presetId);
  const trapRule = (await rules.locator('[data-rule="Setup traps per player"] dd').textContent())!;
  const ownTraps = await page.getByTestId('board').locator('[data-own-trap="true"]').count();
  expect(trapRule.startsWith(String(ownTraps))).toBe(true);
  await expect(rules.locator('[data-rule="Displacers per roster"] dd')).not.toBeEmpty();
  await expect(rules.locator('[data-rule="Repetition draw"] dd')).not.toBeEmpty();

  await attachScreenshot(page, testInfo, 'turn-feedback');
});
