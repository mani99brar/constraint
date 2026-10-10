/// <reference lib="dom" />
// The DOM library types the callbacks that run in the page (page.evaluate).
import { expect, test } from '@playwright/test';
import { legalTakes, newGame, take, tileAt, type GameState } from '@okiya/game';
import { board, cellAt, continueSaved, nearWin, openHome, PALETTES, setPalette } from './helpers';

// The selection outline is the same on every side of every legal tile, in every row and column, edge
// tiles included; the same-symbol cue is a perfect circle (a square box); and on a finished game the win
// outline beats the last-move ring on every tile of the line.

/** A real position with Player 2 to move whose legal tiles include one in the bottom row, one in the last column and a symbol-only match. */
function edgePosition(): GameState {
  for (let seed = 1; seed < 600; seed += 1) {
    let state = newGame({ seed, starter: 'A' });
    while (state.takes.length < 7) {
      const legal = legalTakes(state);
      const next = take(state, legal[(state.takes.length * 3 + seed) % legal.length]!);
      if (!next.ok) break;
      state = next.state;
    }
    if (state.takes.length < 7 || state.result || !state.lastTile) continue;
    const last = state.lastTile;
    const legal = legalTakes(state);
    const symbolOnly = legal.filter((cell) => tileAt(state, cell).symbol === last.symbol && tileAt(state, cell).terrain !== last.terrain);
    if (legal.some((cell) => cell.startsWith('D')) && legal.some((cell) => cell.endsWith('4')) && symbolOnly.length > 0) return state;
  }
  throw new Error('no edge position was found');
}

test('[scenario:legal-outline-edges] a legal tile’s outline is complete on all four sides in every row and column and every theme, and its symbol is a circle', async ({ page }) => {
  test.setTimeout(120_000);
  await openHome(page);
  await continueSaved(page, edgePosition(), 'two-player');
  for (const palette of PALETTES) {
    await setPalette(page, palette);
    const legal = await page.locator('[data-glow="true"]').evaluateAll((cells) => cells.map((cell) => cell.getAttribute('data-cell')!));
    expect(legal.some((cell) => cell.startsWith('D')), `${palette}: a bottom-row tile is legal`).toBe(true);
    expect(legal.some((cell) => cell.endsWith('4')), `${palette}: a last-column tile is legal`).toBe(true);
    // Every cell's symbol box is square, so its disc and its glow are circles.
    const boxes = await page.locator('[data-testid="board"] .tile-symbol').evaluateAll((symbols) => symbols.map((symbol) => { const box = symbol.getBoundingClientRect(); return Math.abs(box.width - box.height); }));
    expect(Math.max(...boxes), `${palette}: symbol boxes are square`).toBeLessThan(0.6);
    const shot = (await board(page).screenshot()).toString('base64');
    const sides = await page.evaluate(async ({ png, cells }) => {
      const bytes = Uint8Array.from(atob(png), (char) => char.charCodeAt(0));
      const bitmap = await createImageBitmap(new Blob([bytes], { type: 'image/png' }));
      const canvas = document.createElement('canvas');
      canvas.width = bitmap.width;
      canvas.height = bitmap.height;
      const context = canvas.getContext('2d', { colorSpace: 'srgb', willReadFrequently: true })!;
      context.drawImage(bitmap, 0, 0);
      const boardBox = document.querySelector('[data-testid="board"]')!.getBoundingClientRect();
      const dpr = bitmap.width / boardBox.width;
      const read = (x: number, y: number) => Array.from(context.getImageData(Math.round((x - boardBox.left) * dpr), Math.round((y - boardBox.top) * dpr), 1, 1).data.slice(0, 3));
      return cells.map((id) => {
        const element = document.querySelector(`[data-testid="board"] [data-cell="${id}"]`)!;
        const box = element.getBoundingClientRect();
        const wash = (getComputedStyle(element).borderTopColor.match(/[\d.]+/g) ?? []).slice(0, 3).map(Number);
        const distance = (pixel: number[]) => Math.hypot(pixel[0]! - wash[0]!, pixel[1]! - wash[1]!, pixel[2]! - wash[2]!);
        // Each side: the closest match to the mover's colour in the 2.4 px band along its edge, at three places along it.
        const nearest = (at: (along: number, depth: number) => [number, number]) => Math.round(Math.min(...[0.3, 0.5, 0.7].flatMap((along) => [0.6, 1.2, 1.8, 2.4].map((depth) => distance(read(...at(along, depth)))))));
        return {
          cell: id,
          distances: {
            top: nearest((along, depth) => [box.left + box.width * along, box.top + depth]),
            bottom: nearest((along, depth) => [box.left + box.width * along, box.bottom - depth]),
            left: nearest((along, depth) => [box.left + depth, box.top + box.height * along]),
            right: nearest((along, depth) => [box.right - depth, box.top + box.height * along]),
          },
        };
      });
    }, { png: shot, cells: legal });
    for (const { cell, distances } of sides) {
      for (const [side, distance] of Object.entries(distances)) expect(distance, `${palette} ${cell} ${side}: the ring is the mover's colour`).toBeLessThanOrEqual(70);
    }
  }
});

test('[scenario:win-outline-beats-last-move] on a finished game every tile of the winning line has the win outline, the last take included, whoever won', async ({ page }) => {
  for (const mover of ['A', 'B'] as const) {
    await openHome(page);
    const { state, wins } = nearWin(mover);
    await continueSaved(page, state, 'two-player');
    await cellAt(page, wins[0]!).click();
    await expect(page.getByTestId('end-screen')).toBeVisible();
    const looks = await page.locator('[data-testid="board"] [data-winning="true"]').evaluateAll((cells) =>
      cells.map((cell) => ({ cell: cell.getAttribute('data-cell')!, last: cell.getAttribute('data-last') === 'true', shadow: getComputedStyle(cell).boxShadow, win: getComputedStyle(document.documentElement).getPropertyValue('--win').trim() })),
    );
    expect(looks).toHaveLength(4);
    expect(looks.some((look) => look.last), `${mover}: the last take is on the line`).toBe(true);
    const first = looks.find((look) => !look.last)!.shadow.match(/rgba?\([^)]*\)/)![0];
    for (const look of looks) expect(look.shadow.match(/rgba?\([^)]*\)/)![0], `${mover} ${look.cell}: outlined in the win colour`).toBe(first);
  }
});

/** A real position with `symbol` as the last tile's symbol and at least two legal tiles matching by symbol alone. */
function symbolPosition(symbol: string): GameState {
  for (let seed = 1; seed < 3000; seed += 1) {
    let state = newGame({ seed, starter: 'A' });
    while (state.takes.length < 5) {
      const legal = legalTakes(state);
      const next = take(state, legal[(state.takes.length * 3 + seed) % legal.length]!);
      if (!next.ok) break;
      state = next.state;
    }
    if (state.takes.length < 5 || state.result || state.lastTile?.symbol !== symbol) continue;
    const last = state.lastTile;
    if (legalTakes(state).filter((cell) => tileAt(state, cell).symbol === symbol && tileAt(state, cell).terrain !== last.terrain).length >= 2) return state;
  }
  throw new Error(`no position for ${symbol}`);
}

test.describe('on an Android phone', () => {
  test.use({
    viewport: { width: 412, height: 915 },
    deviceScaleFactor: 2.625,
    isMobile: true,
    hasTouch: true,
    userAgent: 'Mozilla/5.0 (Linux; Android 14; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Mobile Safari/537.36',
  });

  for (const symbol of ['Moon', 'Sun', 'Star', 'Wave']) {
    test(`[scenario:symbol-cue-circle] the same-${symbol.toLowerCase()} cue is a perfect circle centred on its badge on every tile that matches by symbol`, async ({ page }) => {
      await openHome(page);
      await continueSaved(page, symbolPosition(symbol), 'two-player');
      const looks = await page.locator('[data-match="symbol"], [data-match="both"]').evaluateAll((cells) =>
        cells.map((cell) => {
          const box = cell.querySelector('.tile-symbol')!;
          const rect = box.getBoundingClientRect();
          const disc = box.querySelector('circle')!.getBoundingClientRect();
          const glow = getComputedStyle(box, '::after');
          const inset = glow.inset.split(' ').map(parseFloat);
          return {
            cell: cell.getAttribute('data-cell')!,
            squareBox: Math.abs(rect.width - rect.height),
            offCentre: Math.hypot(rect.left + rect.width / 2 - (disc.left + disc.width / 2), rect.top + rect.height / 2 - (disc.top + disc.height / 2)),
            discRound: Math.abs(disc.width - disc.height),
            glowRound: Math.abs(parseFloat(glow.width) - parseFloat(glow.height)),
            glowEven: Math.max(...inset) - Math.min(...inset),
            fill: getComputedStyle(box.querySelector('circle')!).fill,
            wash: getComputedStyle(cell).borderTopColor,
            ring: getComputedStyle(box).boxShadow,
            stroke: getComputedStyle(box.querySelector('circle')!).strokeWidth,
          };
        }),
      );
      expect(looks.length, `${symbol}: tiles matching by symbol`).toBeGreaterThanOrEqual(2);
      for (const look of looks) {
        expect(look.squareBox, `${look.cell} box is square`).toBeLessThan(0.6);
        expect(look.offCentre, `${look.cell} disc is centred on its box`).toBeLessThan(0.6);
        expect(look.discRound, `${look.cell} disc is round`).toBeLessThan(0.6);
        expect(look.glowRound, `${look.cell} glow is round`).toBeLessThan(0.6);
        expect(look.glowEven, `${look.cell} glow is even on every side`).toBeLessThan(0.6);
        expect(look.fill, `${look.cell} symbol is lit in the mover's colour`).toBe(look.wash);
        // No second ring: no box-shadow ring on the badge and no stroke on its disc.
        expect(look.ring, `${look.cell} badge has no ring`).toBe('none');
        expect(look.stroke, `${look.cell} disc has no stroke`).toMatch(/^(0px|1px)$/);
      }
    });
  }
});
