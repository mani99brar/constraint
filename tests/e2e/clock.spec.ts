/// <reference lib="dom" />
// The DOM library types the callbacks that run in the page (page.evaluate).
import { expect, test, type Page } from '@playwright/test';
import { attachScreenshot, chooseDifficulty, glowing, match, openHome, opponentSwitch, playButton, readScore, seat, seatStatus, takeGlowing } from './helpers';

// Chess clocks for a two-player game: each player's own time, at most five minutes, shown beside the
// name; only the mover's clock runs, the menu pauses it, Continue restores it, and running out loses.
// Playwright's fake clock drives the time, so no test waits on the real one.

const clockOf = (page: Page, player: 'A' | 'B') => page.getByTestId(`seat-${player}-clock`);
const clockSlider = (page: Page, player: 'A' | 'B') => page.getByTestId(`clock-slider-${player}`);
const clockValue = (page: Page, player: 'A' | 'B') => page.getByTestId(`clock-value-${player}`);

/**
 * Where a player's clock sits against their name: beside it on the name's row (a phone) or directly under
 * it (wide screens), with the whole name shown and the clock inside the nameplate.
 */
async function clockWithName(page: Page, player: 'A' | 'B') {
  return page.evaluate((who) => {
    const box = (id: string) => document.querySelector(`[data-testid="${id}"]`)!.getBoundingClientRect();
    const name = box(`seat-${who}-name`);
    const face = box(`seat-${who}-clock`);
    const plate = box(`seat-${who}`);
    const nameElement = document.querySelector(`[data-testid="seat-${who}-name"]`) as HTMLElement;
    return {
      under: face.top >= name.bottom - 1 && Math.abs(face.left - name.left) <= 4,
      beside: Math.abs(name.top + name.height / 2 - (face.top + face.height / 2)) < 8 && face.left >= name.right - 1,
      nameWhole: nameElement.scrollWidth <= nameElement.clientWidth,
      inside: face.left >= plate.left && face.right <= plate.right && face.top >= plate.top && face.bottom <= plate.bottom,
    };
  }, player);
}

/**
 * Opens the home screen on a fake clock and sets each player's clock slider (0 for off, else minutes) with
 * a friend as the opponent.
 */
async function setUpTimedGame(page: Page, a: number, b: number) {
  await page.clock.install({ time: new Date('2026-10-04T12:00:00Z') });
  await openHome(page);
  // Against the bot there are no clocks to set.
  await expect(clockSlider(page, 'A')).toHaveCount(0);
  await opponentSwitch(page).getByRole('radio', { name: 'Friend' }).click();
  for (const player of ['A', 'B'] as const) {
    // A slider from off to five minutes, in whole minutes, named for its player; off at first.
    const slider = clockSlider(page, player);
    await expect(slider).toBeVisible();
    await expect(slider).toHaveAttribute('type', 'range');
    await expect(slider).toHaveAttribute('min', '0');
    await expect(slider).toHaveAttribute('max', '5');
    await expect(slider).toHaveAttribute('step', '1');
    await expect(page.getByRole('slider', { name: `Player ${player === 'A' ? 1 : 2} clock` })).toHaveValue('0');
    await expect(clockValue(page, player)).toHaveText('Off');
  }
  await clockSlider(page, 'A').fill(String(a));
  await clockSlider(page, 'B').fill(String(b));
  const label = (minutes: number) => (minutes === 0 ? 'Off' : `${minutes} min`);
  await expect(clockValue(page, 'A')).toHaveText(label(a));
  await expect(clockValue(page, 'B')).toHaveText(label(b));
}

test('[scenario:pvp-clock] in a two-player game each player has their own clock beside their name, only the mover’s runs, the menu pauses it, Continue restores it, and the player whose time runs out loses', async ({ page }, testInfo) => {
  test.setTimeout(90_000);
  await setUpTimedGame(page, 2, 1);
  await expect(playButton(page)).toHaveText('Play · with a friend · 2:00 / 1:00');
  await playButton(page).click();
  await expect(match(page)).toHaveAttribute('data-timed', 'true');
  await expect(match(page)).toHaveAttribute('data-to-move', 'A');

  // Each clock sits beside its player's name, on the name's row; Player 1 moves first, so only theirs runs.
  await expect(clockOf(page, 'A')).toHaveText('2:00');
  await expect(clockOf(page, 'B')).toHaveText('1:00');
  await expect(clockOf(page, 'A')).toHaveAttribute('data-running', 'true');
  await expect(clockOf(page, 'B')).toHaveAttribute('data-running', 'false');
  await expect(clockOf(page, 'A')).toHaveAttribute('role', 'timer');
  await expect(clockOf(page, 'A')).toHaveAttribute('aria-label', "Player 1's clock, 2 minutes left");
  // On a wide screen each clock sits directly under its player's full name, inside the nameplate.
  for (const player of ['A', 'B'] as const) expect(await clockWithName(page, player), player).toEqual({ under: true, beside: false, nameWhole: true, inside: true });

  await page.clock.runFor(5_000);
  await expect(clockOf(page, 'A')).toHaveText('1:55');
  await expect(clockOf(page, 'B')).toHaveText('1:00');

  // The menu pauses the clock.
  await page.getByTestId('menu-button').click();
  await expect(page.getByRole('dialog', { name: 'Menu' })).toBeVisible();
  await page.clock.runFor(20_000);
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog', { name: 'Menu' })).toHaveCount(0);
  await expect(clockOf(page, 'A')).toHaveText('1:55');

  // A take hands the time over: now Player 2's clock runs and Player 1's stops.
  await takeGlowing(page);
  await expect(match(page)).toHaveAttribute('data-to-move', 'B');
  await page.clock.runFor(3_000);
  await expect(clockOf(page, 'B')).toHaveText('0:57');
  await expect(clockOf(page, 'B')).toHaveAttribute('data-running', 'true');
  await expect(clockOf(page, 'A')).toHaveText('1:55');
  await expect(clockOf(page, 'A')).toHaveAttribute('data-running', 'false');

  // Leaving keeps the clocks where they stopped: Continue restores them, and the mover's runs again.
  await page.getByTestId('menu-button').click();
  await page.getByRole('button', { name: /^Quit to title/ }).click();
  await expect(page.getByTestId('continue')).toContainText('Two players, timed');
  await page.clock.runFor(30_000);
  await page.getByTestId('continue').click();
  await expect(clockOf(page, 'A')).toHaveText('1:55');
  await expect(clockOf(page, 'B')).toHaveText('0:57');
  await expect(clockOf(page, 'B')).toHaveAttribute('data-running', 'true');

  // Under ten seconds the running clock shows as low.
  await page.clock.runFor(48_000);
  await expect(clockOf(page, 'B')).toHaveText('0:09');
  await expect(clockOf(page, 'B')).toHaveAttribute('data-low', 'true');
  await expect(clockOf(page, 'A')).toHaveAttribute('data-low', 'false');
  await attachScreenshot(page, testInfo, 'pvp-clock');

  // Player 2's time runs out: they lose on time, and the score of the sitting counts it for Player 1.
  await page.clock.runFor(10_000);
  const end = page.getByTestId('end-screen');
  await expect(end).toBeVisible();
  await expect(end).toHaveAttribute('data-by', 'time');
  await expect(page.getByTestId('result')).toHaveText('Player 1 wins on time');
  await expect(page.getByTestId('result-detail')).toHaveText("Player 2's clock ran out.");
  await expect(clockOf(page, 'B')).toHaveText('0:00');
  await expect(clockOf(page, 'B')).toHaveAttribute('data-running', 'false');
  await expect(seatStatus(page, 'A')).toHaveText('Winner');
  expect(await readScore(page)).toMatchObject({ a: 1, b: 0, draws: 0 });
  // Nobody can take another tile, and nothing runs any more.
  await expect(glowing(page)).toHaveCount(0);
  await expect(match(page)).toHaveAttribute('data-accepts-takes', 'false');
  await page.clock.runFor(5_000);
  await expect(clockOf(page, 'A')).toHaveText('1:55');

  // Play again keeps the clocks the players chose, from their full time, with the other player starting.
  await page.getByTestId('play-again').click();
  await expect(match(page)).toHaveAttribute('data-takes', '0');
  await expect(clockOf(page, 'A')).toHaveText('2:00');
  await expect(clockOf(page, 'B')).toHaveText('1:00');
  await expect(clockOf(page, 'B')).toHaveAttribute('data-running', 'true');
});

test('[scenario:pvp-clock-layout] a player may have no clock, bot games have none, and the clocks fit the nameplates on a phone and at the narrowest wide layout', async ({ page }, testInfo) => {
  test.setTimeout(60_000);
  // Player 1 untimed, Player 2 on five minutes: only Player 2 has a clock, and Player 1 never runs out.
  await setUpTimedGame(page, 0, 5);
  await expect(playButton(page)).toHaveText('Play · with a friend · no clock / 5:00');
  await playButton(page).click();
  await expect(clockOf(page, 'A')).toHaveCount(0);
  await expect(clockOf(page, 'B')).toHaveText('5:00');
  await page.clock.runFor(400_000);
  await expect(page.getByTestId('end-screen')).toHaveCount(0);
  await expect(clockOf(page, 'B')).toHaveText('5:00');

  // At 390 × 844 the clock fits beside the name inside the nameplate, every tap target stays 44 px, and nothing scrolls sideways.
  await page.setViewportSize({ width: 390, height: 844 });
  await takeGlowing(page);
  await expect(clockOf(page, 'B')).toHaveAttribute('data-running', 'true');
  const rest = async () =>
    page.evaluate(() => {
      const status = document.querySelector('[data-testid="seat-B-status"]') as HTMLElement;
      return { statusOneLine: status.scrollWidth <= status.clientWidth, sideways: document.documentElement.scrollWidth - window.innerWidth };
    });
  expect(await clockWithName(page, 'B')).toEqual({ under: false, beside: true, nameWhole: true, inside: true });
  expect(await rest()).toEqual({ statusOneLine: true, sideways: 0 });
  await attachScreenshot(page, testInfo, 'pvp-clock-layout');

  // On wide screens, from the narrowest wide layout to a large desktop, the clock sits under the whole name.
  for (const width of [761, 1024, 1280, 1600]) {
    await page.setViewportSize({ width, height: 800 });
    expect(await clockWithName(page, 'B'), `${width} px`).toEqual({ under: true, beside: false, nameWhole: true, inside: true });
    expect(await rest(), `${width} px`).toEqual({ statusOneLine: true, sideways: 0 });
  }

  // On a phone the home screen's clock sliders keep a 44 px tall target with their time beside them, and
  // move by keyboard in whole minutes from off to five, the choice remembered.
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByTestId('menu-button').click();
  await page.getByRole('button', { name: /^Quit to title/ }).click();
  for (const player of ['A', 'B'] as const) {
    const slider = (await clockSlider(page, player).boundingBox())!;
    const value = (await clockValue(page, player).boundingBox())!;
    expect(slider.height).toBeGreaterThanOrEqual(44);
    expect(slider.width).toBeGreaterThanOrEqual(150);
    expect(value.x).toBeGreaterThanOrEqual(slider.x + slider.width - 1);
    expect(value.x + value.width).toBeLessThanOrEqual(390);
  }
  expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBe(0);
  const slider = clockSlider(page, 'A');
  await expect(slider).toHaveValue('0');
  await slider.focus();
  await page.keyboard.press('ArrowRight');
  await page.keyboard.press('ArrowRight');
  await expect(slider).toHaveValue('2');
  await expect(slider).toHaveAttribute('aria-valuetext', '2 minutes');
  await expect(clockValue(page, 'A')).toHaveText('2 min');
  await page.keyboard.press('End');
  await expect(slider).toHaveValue('5');
  await page.keyboard.press('ArrowRight');
  await expect(slider).toHaveValue('5');
  await expect(playButton(page)).toHaveText('Play · with a friend · 5:00 / 5:00');
  await page.keyboard.press('Home');
  await expect(slider).toHaveValue('0');
  await expect(slider).toHaveAttribute('aria-valuetext', 'Off');
  await expect(clockValue(page, 'A')).toHaveText('Off');
  // A tap on the track sets it too: near its right end is five minutes.
  const box = (await slider.boundingBox())!;
  await page.mouse.click(box.x + box.width - 4, box.y + box.height / 2);
  await expect(slider).toHaveValue('5');
  await page.reload();
  await expect(clockSlider(page, 'A')).toHaveValue('5');
  await expect(clockSlider(page, 'B')).toHaveValue('5');

  // A bot game has no clocks.
  await page.setViewportSize({ width: 1280, height: 720 });
  await chooseDifficulty(page, 'Easy');
  await expect(seat(page, 'A')).toBeVisible();
  await expect(page.locator('[data-testid$="-clock"]')).toHaveCount(0);
  await expect(match(page)).not.toHaveAttribute('data-timed', /.*/);
});
