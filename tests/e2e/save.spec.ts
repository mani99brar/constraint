/// <reference lib="dom" />
// The DOM library types the callbacks that run in the page (page.addInitScript).
import { expect, test } from '@playwright/test';
import { gameLogOf } from '@okiya/game';
import { BOT_REPLY_MS, chooseDifficulty, match, nearEnding, openHome, takeGlowing } from './helpers';

// Honest saving: when the browser refuses to store the game (a full quota), the game says so once, keeps
// the game in this tab for Continue, never offers an older save in its place, and the menu tells the truth.

const NOTICE = 'This browser couldn’t save your game. Keep this tab open to continue.';

test('[scenario:save-fails] a browser that cannot save says so once, keeps the game for Continue in this tab, and never brings back an older save', async ({ page }) => {
  // A phone, where the menu's longer note wraps to two lines inside Quit to title.
  await page.setViewportSize({ width: 390, height: 844 });
  // An older save from an earlier visit, then a quota that refuses every new save of the game.
  const older = nearEnding('shape', 'A').state;
  const olderSave = JSON.stringify({ version: 3, mode: 'bot', difficulty: 'easy', score: { A: 0, B: 0, draws: 0 }, log: gameLogOf(older) });
  await page.addInitScript((value: string) => {
    const setItem = Storage.prototype.setItem;
    if (!window.sessionStorage.getItem('test.seeded')) {
      window.sessionStorage.setItem('test.seeded', 'true');
      setItem.call(window.localStorage, 'okiya.saved-match', value);
    }
    Storage.prototype.setItem = function (key: string, item: string) {
      if (key === 'okiya.saved-match') throw new DOMException('The quota has been exceeded.', 'QuotaExceededError');
      setItem.call(this, key, item);
    };
  }, olderSave);
  await openHome(page);
  await expect(page.getByTestId('continue')).toContainText(`Easy bot, ${older.takes.length} tiles taken`);

  // A new game replaces it; the browser refuses the save, and one quiet notice says what to do.
  await chooseDifficulty(page, 'Easy');
  const notice = page.locator('[data-testid="toast"][data-kind="save"]');
  await expect(notice).toHaveText(NOTICE);
  await expect(notice).toHaveAttribute('data-tone', 'info');
  await takeGlowing(page);
  await expect(match(page)).toHaveAttribute('data-to-move', 'A', { timeout: BOT_REPLY_MS });
  const takes = await match(page).getAttribute('data-takes');
  // The game keeps going, and no second notice follows the next failed save.
  await expect(page.locator('[data-testid="toast"][data-kind="save"]')).toHaveCount(0, { timeout: 8_000 });

  // The menu does not promise a save it could not make.
  await page.getByTestId('menu-button').click();
  const note = page.getByTestId('menu-save-note');
  await expect(note).toHaveAttribute('data-saved', 'false');
  await expect(note).toHaveText('Not saved in this browser; Continue picks it up while this tab stays open.');
  await expect(page.getByRole('dialog', { name: 'Menu' })).not.toContainText('Your game is saved');
  // The two-line note stays inside its button's border while the menu scrolls.
  const fits = await page.getByTestId('menu-quit').evaluate((button) => button.scrollHeight <= button.clientHeight + 1);
  expect(fits).toBe(true);

  // Quit to title: Continue picks up this game from memory, never the older save.
  await page.getByRole('button', { name: /^Quit to title/ }).click();
  const resume = page.getByTestId('continue');
  await expect(resume).toContainText(`Easy bot, ${takes} tiles taken, kept only in this tab`);
  await resume.click();
  await expect(match(page)).toHaveAttribute('data-takes', takes!);
  // The resumed game is still the unsaved one, and the menu still says so.
  await page.getByTestId('menu-button').click();
  await expect(note).toHaveAttribute('data-saved', 'false');

  // Closing the tab loses it, as the notice said; the older save was removed, so it never comes back.
  await page.reload();
  await expect(page.getByTestId('home-screen')).toBeVisible();
  await expect(page.getByTestId('continue')).toHaveCount(0);
});

test('[scenario:save-works] when the browser saves the game the menu says Continue picks it up', async ({ page }) => {
  await openHome(page);
  await chooseDifficulty(page, 'Easy');
  await takeGlowing(page);
  await expect(page.locator('[data-testid="toast"][data-kind="save"]')).toHaveCount(0);
  await page.getByTestId('menu-button').click();
  await expect(page.getByTestId('menu-save-note')).toHaveAttribute('data-saved', 'true');
  await expect(page.getByTestId('menu-save-note')).toHaveText('Your game is saved; Continue picks it up.');
});
