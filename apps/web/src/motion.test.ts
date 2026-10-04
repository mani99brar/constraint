import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

// Under reduced motion no animation or transition plays (PRD U8). The stylesheet holds the only switch,
// and every animation is CSS, so the switch reaches all of them.

const css = readFileSync(join(import.meta.dirname, 'styles.css'), 'utf8');
const sources = ['Avatar.tsx', 'Board.tsx', 'MatchCard.tsx', 'Seat.tsx', 'MatchScreen.tsx', 'Token.tsx', 'HowToPlay.tsx'].map((file) => readFileSync(join(import.meta.dirname, file), 'utf8'));

/** Every duration in a declaration, in milliseconds. */
function durations(text: string): number[] {
  return [...text.matchAll(/(\d+(?:\.\d+)?)(ms|s)\b/g)].map(([, value, unit]) => Number(value) * (unit === 's' ? 1000 : 1));
}

describe('reduced motion (PRD U8)', () => {
  it('turns off every animation and transition, pseudo-elements included', () => {
    const block = /@media\s*\(prefers-reduced-motion:\s*reduce\)\s*\{([\s\S]*?\})\s*\}/.exec(css)?.[1] ?? '';
    expect(block).toMatch(/\*\s*,\s*\*::before\s*,\s*\*::after\s*\{/);
    expect(block).toMatch(/animation:\s*none\s*!important/);
    expect(block).toMatch(/transition:\s*none\s*!important/);
  });

  it('keeps every animation and transition under 400 ms, with none looping', () => {
    const declarations = [...css.matchAll(/^\s*(animation|transition)\s*:\s*([^;]+);/gm)].map((match) => match[2]!).filter((value) => !/^none/.test(value));
    expect(declarations.length).toBeGreaterThanOrEqual(6);
    for (const value of declarations) {
      expect(value).not.toMatch(/infinite/);
      for (const ms of durations(value)) expect(ms, value).toBeLessThan(400);
    }
  });

  it('animates only through CSS, never through script timing the reduced-motion switch cannot reach', () => {
    for (const source of sources) expect(source).not.toMatch(/\.animate\(|requestAnimationFrame|setInterval/);
  });
});
