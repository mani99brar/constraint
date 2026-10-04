import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

// Motion (PRD U8, U9) and the materials' rules (PRD U1): every animation and transition is CSS, under
// 400 ms with its delay, never looping, and off under the stylesheet's one reduced-motion switch. The
// materials are static gradients and shadows: no blur, no backdrop filter, no filter on a board cell and
// no url(#…) fill.

const css = readFileSync(join(import.meta.dirname, 'styles.css'), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
const files = ['Avatar.tsx', 'Board.tsx', 'MatchCard.tsx', 'Seat.tsx', 'MatchScreen.tsx', 'Token.tsx', 'HowToPlay.tsx', 'HomeScreen.tsx', 'Toasts.tsx', 'art.tsx'];
const sources = files.map((file) => [file, readFileSync(join(import.meta.dirname, file), 'utf8')] as const);

/** Every innermost rule of the stylesheet: its selector and its declarations. */
const rules = [...css.matchAll(/([^{}]+)\{([^{}]*)\}/g)].map((match) => ({ selector: match[1]!.trim(), body: match[2]! }));

/** Every declaration of a property across the stylesheet, without its `!important`. */
function declarations(property: string): string[] {
  return rules.flatMap(({ body }) => [...body.matchAll(new RegExp(`(?:^|;|\\s)${property}\\s*:\\s*([^;]+)`, 'g'))].map((match) => match[1]!.replace(/!important/, '').trim()));
}

/** Every time in a value, in milliseconds. */
function times(text: string): number[] {
  return [...text.matchAll(/(-?\d*\.?\d+)(ms|s)\b/g)].map(([, value, unit]) => Number(value) * (unit === 's' ? 1000 : 1));
}

/** The declarations of the rule with exactly this selector. */
const rule = (selector: string) =>
  rules
    .filter((candidate) => candidate.selector === selector)
    .map((candidate) => candidate.body)
    .join(';');

describe('reduced motion (PRD U8)', () => {
  it('turns off every animation and transition, pseudo-elements included', () => {
    const block = /@media\s*\(prefers-reduced-motion:\s*reduce\)\s*\{([\s\S]*?\})\s*\}/.exec(css)?.[1] ?? '';
    expect(block).toMatch(/\*\s*,\s*\*::before\s*,\s*\*::after\s*\{/);
    expect(block).toMatch(/animation:\s*none\s*!important/);
    expect(block).toMatch(/transition:\s*none\s*!important/);
  });

  it('keeps every animation and transition under 400 ms with its delay, through the shorthands', () => {
    const shorthands = [...declarations('animation'), ...declarations('transition')].filter((value) => !/^none/.test(value));
    expect(shorthands.length).toBeGreaterThanOrEqual(12);
    for (const value of shorthands) {
      expect(value, value).not.toMatch(/infinite|alternate/);
      // Each comma-separated part: its duration, then an optional delay, together under 400 ms.
      for (const part of value.split(/,(?![^(]*\))/)) {
        const [duration = 0, delay = 0] = times(part);
        expect(duration + Math.max(0, delay), part).toBeLessThan(400);
        // An iteration count other than 1 would repeat the motion.
        expect(part.replace(/cubic-bezier\([^)]*\)|steps\([^)]*\)|-?\d*\.?\d+m?s\b/g, ''), part).not.toMatch(/(^|\s)(?!1(\s|$))\d+(\.\d+)?(\s|$)/);
      }
    }
  });

  it('keeps the longhands under 400 ms and never repeating', () => {
    for (const property of ['animation-duration', 'animation-delay', 'transition-duration', 'transition-delay']) {
      for (const value of declarations(property)) for (const ms of times(value)) expect(ms, `${property}: ${value}`).toBeLessThan(400);
    }
    for (const value of declarations('animation-iteration-count')) expect(value).toMatch(/^1(\s*,\s*1)*$/);
    // A longhand delay and the shorthand's duration in the same rule add up under 400 ms too.
    for (const { selector, body } of rules) {
      const delay = Math.max(0, ...times(/animation-delay\s*:\s*([^;]+)/.exec(body)?.[1] ?? ''), ...times(/transition-delay\s*:\s*([^;]+)/.exec(body)?.[1] ?? ''));
      const duration = Math.max(0, ...times(/(?:^|;|\s)(?:animation|transition)(?:-duration)?\s*:\s*([^;]+)/.exec(body)?.[1] ?? ''));
      expect(duration + delay, selector).toBeLessThan(400);
    }
  });

  it('names the motion of the table: the token drop, the reactions, the tile flight, the seat change, the seat change and the winning stroke', () => {
    // A placed token drops into its cell and settles; it never takes a tap.
    expect(rule('.token')).toMatch(/animation:\s*token-drop\s/);
    expect(rule('.token')).toMatch(/pointer-events:\s*none/);
    expect(css).toMatch(/@keyframes token-drop\s*\{/);
    // The avatars' reactions, started by the keyed group's data-motion, which never takes a tap.
    expect(rule(".avatar-motion[data-motion='nod']")).toMatch(/animation:\s*avatar-nod\s/);
    expect(rule(".avatar-p1 .avatar-motion[data-motion='glance']")).toMatch(/animation:\s*avatar-glance-right\s/);
    expect(rule(".avatar-p2 .avatar-motion[data-motion='glance']")).toMatch(/animation:\s*avatar-glance-left\s/);
    expect(rule(".avatar-motion[data-motion='wince']")).toMatch(/animation:\s*avatar-wince\s/);
    expect(rule(".avatar-motion[data-motion='bounce']")).toMatch(/animation:\s*avatar-bounce\s/);
    for (const name of ['avatar-nod', 'avatar-glance-right', 'avatar-glance-left', 'avatar-wince', 'avatar-bounce']) expect(css).toMatch(new RegExp(`@keyframes ${name}\\s*\\{`));
    expect(rule('.avatar-motion')).toMatch(/pointer-events:\s*none/);
    // The tile flying into the Match card, which never takes a tap.
    expect(rule('.match-tile.arriving')).toMatch(/animation:\s*tile-arrive\s/);
    expect(css).toMatch(/@keyframes tile-arrive\s*\{[\s\S]*?translate\(var\(--from-x/);
    expect(rule('.match-tile')).toMatch(/pointer-events:\s*none/);
    // The seats lighting and dimming and the winning stroke. A new face shows at once, so a seat with no
    // reaction never moves when the shared reaction key remounts both avatars' groups.
    expect(rule('.seat')).toMatch(/transition:[^;]*border-color[^;]*background-color/);
    expect(rule('.face')).not.toMatch(/animation/);
    expect(css).not.toMatch(/@keyframes face-in/);
    expect(rule('.win-stroke path')).toMatch(/animation:\s*stroke-draw\s/);
    // The toasts' slot never takes a tap.
    expect(rule('.toasts')).toMatch(/pointer-events:\s*none/);
  });

  it('animates only through CSS, never through script timing the reduced-motion switch cannot reach', () => {
    for (const [file, source] of sources) expect(source, file).not.toMatch(/\.animate\(|requestAnimationFrame|setInterval/);
  });
});

describe('static materials (PRD U1)', () => {
  it('uses no blur filter and no backdrop filter anywhere', () => {
    expect(css).not.toMatch(/filter\s*:\s*[^;]*blur\(/);
    expect(css).not.toMatch(/backdrop-filter/);
  });

  it('puts no filter on any rule whose selector targets board cells', () => {
    const cellRules = rules.filter(({ selector }) => /\.cell\b/.test(selector));
    expect(cellRules.length).toBeGreaterThan(5);
    for (const { selector, body } of cellRules) expect(body, selector).not.toMatch(/(^|[;\s])filter\s*:/);
    // The detector sees a filter on a cell rule.
    expect(/(^|[;\s])filter\s*:/.test(' filter: brightness(1.04)')).toBe(true);
  });

  it('draws no url(#…) fill and no SVG defs or patterns, in the stylesheet or the components', () => {
    expect(css).not.toMatch(/url\(\s*['"]?#/);
    for (const [file, source] of sources) expect(source, file).not.toMatch(/url\(#|<defs|<pattern|<linearGradient|<radialGradient/);
  });

  it('keeps a solid background colour under every token and the avatars’ discs, with the shading on top', () => {
    expect(rule('.token')).toMatch(/background-color:\s*var\(--p1\)/);
    expect(rule('.token')).toMatch(/background-image:\s*radial-gradient/);
    expect(rule('.token.p2')).toMatch(/background-color:\s*var\(--p2\)/);
    expect(rule('.avatar')).toMatch(/background-color:\s*var\(--surface\)/);
    // No background shorthand drops a solid colour on the pieces or the materials.
    for (const { selector, body } of rules) if (/\.(token|cell|board-frame|seat|avatar|wordmark)\b/.test(selector)) expect(body, selector).not.toMatch(/(^|[;\s])background\s*:/);
  });
});
