/// <reference lib="dom" />
// The DOM library types the callbacks that run in the page (page.evaluate).
import { expect, test, type Page } from '@playwright/test';
import { attachScreenshot, BOT_STARTS, board, chooseDifficulty, glowing, match, opponentSwitch, openHome, playButton, takeCount, takeGlowing } from './helpers';

// The short countdown before a new game: 3, 2, 1 over the board, about 1.8 s in all, during which nobody
// takes, nothing glows, the bot waits and no clock runs. A tap or a key starts at once; Continue never
// counts down; the menu's Countdown switch turns it off. Playwright's fake clock drives the time.

const countdown = (page: Page) => page.getByTestId('countdown');

/** Opens the home screen on a fake clock with the countdown on, as a player's first visit has it. */
async function openWithCountdown(page: Page, seed?: number) {
  // The fake clock is paused: time moves only when the test runs it, so no check races the countdown.
  await page.clock.install({ time: new Date('2026-10-05T09:00:00Z') });
  await page.clock.pauseAt(new Date('2026-10-05T09:00:01Z'));
  await openHome(page, seed);
  await page.evaluate(() => {
    const stored = JSON.parse(window.localStorage.getItem('okiya.settings') ?? '{}');
    window.localStorage.setItem('okiya.settings', JSON.stringify({ ...stored, countdown: true }));
  });
  await page.reload();
  await expect(page.getByTestId('home-screen')).toBeVisible();
}

test('[scenario:game-countdown] a new game opens with a 3, 2, 1 countdown over the board while nothing can be taken, nothing glows, the bot waits and no clock runs; a tap or a key starts at once, Continue skips it, and the menu turns it off', async ({ page }, testInfo) => {
  test.setTimeout(90_000);
  await openWithCountdown(page);

  // A two-player game with clocks: the countdown shows 3 over the board, which waits.
  await opponentSwitch(page).getByRole('radio', { name: 'Friend' }).click();
  await page.getByTestId('clock-slider-A').fill('1');
  await page.getByTestId('clock-slider-B').fill('1');
  await playButton(page).click();
  await expect(board(page)).toBeVisible();
  await expect(countdown(page)).toBeVisible();
  await expect(countdown(page)).toHaveAttribute('data-count', '3');
  await expect(countdown(page)).toHaveAttribute('role', 'status');
  await expect(countdown(page)).toContainText('Starting in 3');
  await expect(match(page)).toHaveAttribute('data-starting', 'true');
  await expect(match(page)).toHaveAttribute('data-accepts-takes', 'false');
  await expect(glowing(page)).toHaveCount(0);
  // The countdown sits over the board and inside it.
  const [frame, overlay] = await Promise.all([page.getByTestId('board-frame').boundingBox(), countdown(page).boundingBox()]);
  expect(overlay!.x).toBeGreaterThanOrEqual(frame!.x - 1);
  expect(overlay!.x + overlay!.width).toBeLessThanOrEqual(frame!.x + frame!.width + 1);
  await attachScreenshot(page, testInfo, 'game-countdown');

  // 2, then 1, about 600 ms apart; the clocks have not moved.
  await page.clock.runFor(600);
  await expect(countdown(page)).toHaveAttribute('data-count', '2');
  await page.clock.runFor(600);
  await expect(countdown(page)).toHaveAttribute('data-count', '1');
  await expect(page.getByTestId('seat-A-clock')).toHaveText('1:00');
  await expect(page.getByTestId('seat-A-clock')).toHaveAttribute('data-running', 'false');

  // Then the game starts: the legal tiles glow, a take works, and Player 1's clock runs from the start.
  await page.clock.runFor(600);
  await expect(countdown(page)).toHaveCount(0);
  await expect(match(page)).not.toHaveAttribute('data-starting', /.*/);
  await expect(match(page)).toHaveAttribute('data-accepts-takes', 'true');
  await expect(glowing(page).first()).toBeVisible();
  await expect(page.getByTestId('seat-A-clock')).toHaveAttribute('data-running', 'true');
  await page.clock.runFor(2_000);
  await expect(page.getByTestId('seat-A-clock')).toHaveText('0:58');
  await takeGlowing(page);
  expect(await takeCount(page)).toBe(1);

  // Continue resumes without a countdown.
  await page.getByTestId('menu-button').click();
  await page.getByRole('button', { name: /^Quit to title/ }).click();
  await page.getByTestId('continue').click();
  await expect(board(page)).toBeVisible();
  await expect(countdown(page)).toHaveCount(0);
  await expect(match(page)).toHaveAttribute('data-accepts-takes', 'true');

  // Play from the home screen counts down again; a tap on it starts at once, without taking a tile.
  await page.getByTestId('menu-button').click();
  await page.getByRole('button', { name: /^Quit to title/ }).click();
  await playButton(page).click();
  await expect(countdown(page)).toHaveAttribute('data-count', '3');
  const centre = (await countdown(page).boundingBox())!;
  await page.mouse.click(centre.x + centre.width / 2, centre.y + centre.height / 2);
  await expect(countdown(page)).toHaveCount(0);
  expect(await takeCount(page)).toBe(0);
  await expect(glowing(page).first()).toBeVisible();

  // So does Enter.
  await page.getByTestId('menu-button').click();
  await page.getByRole('button', { name: /^Quit to title/ }).click();
  await playButton(page).click();
  await expect(countdown(page)).toBeVisible();
  await page.keyboard.press('Enter');
  await expect(countdown(page)).toHaveCount(0);
  expect(await takeCount(page)).toBe(0);

  // The menu's Countdown switch turns it off, and the choice is remembered.
  await page.getByTestId('menu-button').click();
  const toggle = page.getByTestId('setting-countdown');
  await expect(toggle).toHaveAttribute('aria-checked', 'true');
  await toggle.click();
  await expect(toggle).toHaveAttribute('aria-checked', 'false');
  await page.getByRole('button', { name: /^Quit to title/ }).click();
  await page.reload();
  await playButton(page).click();
  await expect(board(page)).toBeVisible();
  await expect(countdown(page)).toHaveCount(0);
  await expect(glowing(page).first()).toBeVisible();
});

test('[scenario:game-countdown-bot] when the bot starts, it waits for the countdown, then takes after its usual pause', async ({ page }, testInfo) => {
  test.setTimeout(60_000);
  await openWithCountdown(page, BOT_STARTS);
  await chooseDifficulty(page, 'Easy');
  await expect(countdown(page)).toBeVisible();
  await expect(match(page)).toHaveAttribute('data-to-move', 'B');
  // Each step of the countdown is scheduled once the last one has shown, so the time runs a step at a
  // time. 1.2 s in, well past the bot's usual 600 ms pause, the bot still has not taken.
  await page.clock.runFor(600);
  await expect(countdown(page)).toHaveAttribute('data-count', '2');
  await page.clock.runFor(600);
  await expect(countdown(page)).toHaveAttribute('data-count', '1');
  expect(await takeCount(page)).toBe(0);
  await page.clock.runFor(600);
  await expect(countdown(page)).toHaveCount(0);
  // Now the bot takes after its pause.
  await page.clock.runFor(2_000);
  await expect.poll(() => takeCount(page)).toBe(1);
  await expect(match(page)).toHaveAttribute('data-to-move', 'A');
  await attachScreenshot(page, testInfo, 'game-countdown-bot');
});
