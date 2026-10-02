import { expect, type Locator, type Page, type TestInfo } from '@playwright/test';

export async function attachScreenshot(page: Page, testInfo: TestInfo, id: string) {
  const path = testInfo.outputPath(`${id}.png`);
  await page.screenshot({ path, fullPage: true });
  await testInfo.attach(`screenshot:${id}`, { path, contentType: 'image/png' });
}

export interface StartOptions {
  readonly seed: number;
  /** A preset id from the start screen; the default preset when absent. */
  readonly preset?: string;
  /** A scenario id from the start screen's list. */
  readonly scenario?: string;
  /** "Easy", "Normal" or "Hard". */
  readonly depth?: string;
}

/** Fills the match-start form and starts; the page then shows setup, or the match for a fixed scenario. */
export async function startFromLanding(page: Page, { seed, preset, scenario, depth }: StartOptions) {
  await page.goto(`/?seed=${seed}`);
  if (preset) await page.getByRole('radio', { name: new RegExp(preset.replaceAll('.', '\\.') + '(?![-\\w])') }).check();
  if (scenario) await page.getByTestId('scenario-select').selectOption(scenario);
  if (depth) await page.getByRole('radio', { name: new RegExp(`^${depth}\\b`) }).check();
  await page.getByRole('button', { name: 'Start match' }).click();
}

/** Opens the setup screen of a match. */
export async function openSetup(page: Page, options: StartOptions) {
  await startFromLanding(page, options);
  await expect(page.getByTestId('setup-board')).toBeVisible();
}

/** Starts a match through the setup screen's "Use default setup" button. */
export async function startMatch(page: Page, options: StartOptions) {
  await openSetup(page, options);
  await page.getByRole('button', { name: 'Use default setup' }).click();
  await expect(page.getByTestId('board')).toBeVisible();
}

export const isEdge = (cell: string) => /^[AD]/.test(cell) || /[14]$/.test(cell);

/** Deploys the first reserve fighter onto the first highlighted cell; returns the cell and the fighter's name. */
export async function deployFirst(page: Page) {
  const button = page.getByTestId('reserve').getByRole('button').first();
  const name = (await button.textContent())!;
  await button.click();
  const target = page.locator('[data-cell][data-highlighted="true"]').first();
  await expect(target).toBeVisible();
  const cell = (await target.getAttribute('data-cell'))!;
  await target.click();
  return { cell, name };
}

/** Waits until the human may act again, or the match has ended. */
export async function waitForHumanTurn(page: Page) {
  await expect(page.getByTestId('turn')).not.toHaveText("Bot's turn", { timeout: 15_000 });
}

/** The tile pairs of the board, cell by cell, as read from the page. */
export async function boardTiles(board: Locator): Promise<string[]> {
  return board.locator('[data-cell]').evaluateAll((cells) =>
    cells.map((cell) => `${cell.getAttribute('data-cell')}:${cell.getAttribute('data-terrain')}-${cell.getAttribute('data-symbol')}`),
  );
}
