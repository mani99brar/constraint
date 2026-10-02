import { expect, test, type Page, type TestInfo } from '@playwright/test';

// The seed only fixes who starts: with seed 1 the human opens. Everything else is read from the page.
const HUMAN_STARTS_SEED = 1;

async function attachScreenshot(page: Page, testInfo: TestInfo, id: string) {
  const path = testInfo.outputPath(`${id}.png`);
  await page.screenshot({ path, fullPage: true });
  await testInfo.attach(`screenshot:${id}`, { path, contentType: 'image/png' });
}

async function startMatch(page: Page) {
  await page.goto(`/?seed=${HUMAN_STARTS_SEED}`);
  await page.getByRole('button', { name: 'Start match' }).click();
  await expect(page.getByTestId('board')).toBeVisible();
}

const isEdge = (cell: string) => /^[AD]/.test(cell) || /[14]$/.test(cell);

test('[scenario:start-match] the landing page starts a match against the bot', async ({ page }, testInfo) => {
  await startMatch(page);

  const cells = page.locator('[data-cell]');
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
  await expect(refusedCell).toHaveAttribute('data-highlighted', 'false');
  const refusedTerrain = (await refusedCell.getAttribute('data-terrain'))!;
  const refusedSymbol = (await refusedCell.getAttribute('data-symbol'))!;
  await page.getByTestId('reserve').getByRole('button').first().click();
  await refusedCell.click();

  await expect(page.getByTestId('refusal')).toHaveText(
    `${refusedTerrain}–${refusedSymbol} does not match ${currentTerrain} or ${currentSymbol}.`,
  );
  await expect(turn).toHaveText('Your turn');
  await expect(turn).toHaveAttribute('data-turn', turnNumber!);
  await expect(log).toHaveCount(2);

  await attachScreenshot(page, testInfo, 'legal-turn');
});
