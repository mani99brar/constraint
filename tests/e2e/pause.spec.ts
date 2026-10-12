/// <reference lib="dom" />
// The DOM library types the callbacks that run in the page (page.evaluate).
import { expect, test, type Page } from '@playwright/test';
import { BOT_STARTS, chooseDifficulty, match, openHome, opponentSwitch, playButton, takeGlowing } from './helpers';

// One pause policy: while the menu is open or the page is hidden, the bot's take waits and no clock runs;
// on resume the bot takes after its usual short pause and the mover's clock runs on from where it stopped.
// Playwright's fake clock drives the time, so no test waits on the real one.

const clockOf = (page: Page, player: 'A' | 'B') => page.getByTestId(`seat-${player}-clock`);
const menuDialog = (page: Page) => page.getByRole('dialog', { name: 'Menu' });

/** Installs a paused fake clock, so time moves only when the test runs it. */
async function fakeClock(page: Page) {
  await page.clock.install({ time: new Date('2026-10-04T12:00:00Z') });
  await page.clock.pauseAt(new Date('2026-10-04T12:00:01Z'));
}

/**
 * Hides or shows the page as switching tabs would: a headless page is always visible, so the test
 * overrides `document.visibilityState` and `document.hidden` and fires `visibilitychange`.
 */
async function setPageHidden(page: Page, hidden: boolean) {
  await page.evaluate((value) => {
    Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => (value ? 'hidden' : 'visible') });
    Object.defineProperty(document, 'hidden', { configurable: true, get: () => value });
    document.dispatchEvent(new Event('visibilitychange'));
  }, hidden);
}

test('[scenario:pause-bot] the bot never takes while the menu is open or the page is hidden, and takes after its short pause on resume', async ({ page }) => {
  await fakeClock(page);
  await openHome(page, BOT_STARTS);
  await chooseDifficulty(page, 'Easy');
  await expect(match(page)).toHaveAttribute('data-to-move', 'B');
  await expect(match(page)).toHaveAttribute('data-takes', '0');

  // The menu opens before the bot's pause is over: its take waits as long as the menu stays open.
  await page.getByTestId('menu-button').click();
  await expect(menuDialog(page)).toBeVisible();
  await page.clock.runFor(10_000);
  await expect(match(page)).toHaveAttribute('data-takes', '0');
  await page.keyboard.press('Escape');
  await expect(menuDialog(page)).toHaveCount(0);
  await page.clock.runFor(1_000);
  await expect(match(page)).toHaveAttribute('data-takes', '1');
  await expect(match(page)).toHaveAttribute('data-to-move', 'A');

  // A hidden page holds the bot's next take the same way.
  await takeGlowing(page);
  await expect(match(page)).toHaveAttribute('data-to-move', 'B');
  await setPageHidden(page, true);
  await page.clock.runFor(10_000);
  await expect(match(page)).toHaveAttribute('data-takes', '2');
  await setPageHidden(page, false);
  await page.clock.runFor(1_000);
  await expect(match(page)).toHaveAttribute('data-takes', '3');
});

test('[scenario:pause-clock] a hidden page stops a two-player game’s clocks, which run on from where they stopped when it shows again', async ({ page }) => {
  await fakeClock(page);
  await openHome(page);
  await opponentSwitch(page).getByRole('radio', { name: 'Friend' }).click();
  await page.getByTestId('clock-slider-A').fill('2');
  await page.getByTestId('clock-slider-B').fill('1');
  await playButton(page).click();
  await expect(match(page)).toHaveAttribute('data-to-move', 'A');
  await page.clock.runFor(5_000);
  await expect(clockOf(page, 'A')).toHaveText('1:55');

  // Away from the tab for a minute: Player 1's clock holds, and nobody loses on time.
  await setPageHidden(page, true);
  await page.clock.runFor(60_000);
  await setPageHidden(page, false);
  await expect(clockOf(page, 'A')).toHaveText('1:55');
  await expect(clockOf(page, 'A')).toHaveAttribute('data-running', 'true');
  await expect(page.getByTestId('end-screen')).toBeHidden();
  await page.clock.runFor(5_000);
  await expect(clockOf(page, 'A')).toHaveText('1:50');
  await expect(clockOf(page, 'B')).toHaveText('1:00');
});
