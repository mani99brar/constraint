import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

// Motion (PRD U8, U9, U10) and the materials' rules (PRD U1): every animation and transition is CSS,
// under 400 ms with its delay, never looping, and off under the stylesheet's one reduced-motion switch;
// the one exception is the end sequence, whose rules (marked by data-end) take at most 700 ms from their
// longest delay and their longest animation. The materials are static gradients and shadows: no blur, no
// backdrop filter, no filter on a board cell and no url(#…) fill, and the ground has no felt and no
// repeating pattern.

const css = readFileSync(join(import.meta.dirname, 'styles.css'), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
const files = ['Avatar.tsx', 'Board.tsx', 'MatchCard.tsx', 'Seat.tsx', 'MatchScreen.tsx', 'EndScreen.tsx', 'Token.tsx', 'HowToPlay.tsx', 'HomeScreen.tsx', 'Toasts.tsx', 'art.tsx'];
const sources = files.map((file) => [file, readFileSync(join(import.meta.dirname, file), 'utf8')] as const);

/** Every innermost rule of the stylesheet outside @keyframes: its selector and its declarations. */
const rules = [...css.replace(/@keyframes[^{]*\{(?:[^{}]*\{[^{}]*\})*[^{}]*\}/g, '').matchAll(/([^{}]+)\{([^{}]*)\}/g)].map((match) => ({ selector: match[1]!.trim(), body: match[2]! }));

/** The end sequence's rules (PRD U10): the cells' and the stroke's data-end parts. */
const isEndRule = (selector: string) => /\[data-end=/.test(selector);
const endRules = rules.filter(({ selector }) => isEndRule(selector));
const otherRules = rules.filter(({ selector }) => !isEndRule(selector));

/** Every declaration of a property across the given rules, without its `!important`. */
function declarations(property: string, within = otherRules): string[] {
  return within.flatMap(({ body }) => [...body.matchAll(new RegExp(`(?:^|;|\\s)${property}\\s*:\\s*([^;]+)`, 'g'))].map((match) => match[1]!.replace(/!important/, '').trim()));
}

/** The duration and the delay of each comma-separated part of an animation or transition shorthand. */
function parts(value: string): { duration: number; delay: number; rest: string }[] {
  return value.split(/,(?![^(]*\))/).map((part) => {
    const [duration = 0, delay = 0] = times(part);
    return { duration, delay: Math.max(0, delay), rest: part.replace(/cubic-bezier\([^)]*\)|steps\([^)]*\)|-?\d*\.?\d+m?s\b/g, '') };
  });
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

  it('keeps every animation and transition outside the end sequence under 400 ms with its delay, through the shorthands', () => {
    const shorthands = [...declarations('animation'), ...declarations('transition')].filter((value) => !/^none/.test(value));
    expect(shorthands.length).toBeGreaterThanOrEqual(12);
    for (const value of shorthands) {
      expect(value, value).not.toMatch(/infinite|alternate/);
      for (const { duration, delay, rest } of parts(value)) {
        expect(duration + delay, value).toBeLessThan(400);
        // An iteration count other than 1 would repeat the motion.
        expect(rest, value).not.toMatch(/(^|\s)(?!1(\s|$))\d+(\.\d+)?(\s|$)/);
      }
    }
  });

  it('keeps the longhands outside the end sequence under 400 ms and never repeating', () => {
    for (const property of ['animation-duration', 'animation-delay', 'transition-duration', 'transition-delay']) {
      for (const value of declarations(property)) for (const ms of times(value)) expect(ms, `${property}: ${value}`).toBeLessThan(400);
    }
    for (const value of declarations('animation-iteration-count', rules)) expect(value).toMatch(/^1(\s*,\s*1)*$/);
    // A longhand delay and the shorthand's duration in the same rule add up under 400 ms too.
    for (const { selector, body } of otherRules) {
      const delay = Math.max(0, ...times(/animation-delay\s*:\s*([^;]+)/.exec(body)?.[1] ?? ''), ...times(/transition-delay\s*:\s*([^;]+)/.exec(body)?.[1] ?? ''));
      const duration = Math.max(0, ...times(/(?:^|;|\s)(?:animation|transition)(?:-duration)?\s*:\s*([^;]+)/.exec(body)?.[1] ?? ''));
      expect(duration + delay, selector).toBeLessThan(400);
    }
  });

  it('keeps the whole end sequence at or under 700 ms: its longest delay plus its longest animation, through shorthands and longhands, never repeating', () => {
    expect(endRules.length).toBeGreaterThanOrEqual(6);
    const durations: number[] = [];
    const delays: number[] = [];
    for (const { selector, body } of endRules) {
      for (const value of declarations('animation', [{ selector, body }])) {
        expect(value, selector).not.toMatch(/infinite|alternate/);
        for (const { duration, delay, rest } of parts(value)) {
          durations.push(duration);
          delays.push(delay);
          expect(rest, selector).not.toMatch(/(^|\s)(?!1(\s|$))\d+(\.\d+)?(\s|$)/);
        }
      }
      for (const value of declarations('animation-duration', [{ selector, body }])) durations.push(...times(value));
      for (const value of declarations('animation-delay', [{ selector, body }])) delays.push(...times(value).map((ms) => Math.max(0, ms)));
      // The end sequence moves by animations only.
      expect(declarations('transition', [{ selector, body }]), selector).toEqual([]);
    }
    expect(Math.max(...durations) + Math.max(...delays)).toBeLessThanOrEqual(700);
    // The lifts go one after another: each later token waits longer.
    const lifts = [1, 2, 3].map((order) => times(endRules.find(({ selector }) => selector.includes(`[data-lift-order='${order}']`))!.body)[0]!);
    expect(lifts).toEqual([...lifts].sort((a, b) => a - b));
    expect(new Set(lifts).size).toBe(3);
  });

  it('names the motion of the table: the token drop, the reactions, the Match card’s crossfade, the seat change and the end sequence, and no tile flight', () => {
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
    // No tile flies from the board into the Match card (PRD U8): its contents crossfade in place under 200 ms.
    expect(css).not.toMatch(/tile-arrive|arriving|--from-x/);
    for (const source of ['MatchCard.tsx', 'Board.tsx'].map((file) => readFileSync(join(import.meta.dirname, file), 'utf8'))) expect(source).not.toMatch(/arriving|tile-arrive|getBoundingClientRect\(\)[\s\S]*--from/);
    const fade = /animation:\s*match-fade\s+([^;]+)/.exec(rule('.match-tile,\n.match-text'))?.[1] ?? '';
    expect(times(fade)[0]).toBeLessThan(200);
    expect(rule('.match-tile')).toMatch(/pointer-events:\s*none/);
    // The seats lighting and dimming. A new face shows at once, so a seat with no reaction never moves
    // when the shared reaction key remounts both avatars' groups.
    expect(rule('.seat')).toMatch(/transition:[^;]*border-color[^;]*background-color/);
    expect(rule('.face')).not.toMatch(/animation/);
    expect(css).not.toMatch(/@keyframes face-in/);
    // The end sequence: the lifts, the stroke, the dim, the grey and the settle, and the skip to its final frame.
    expect(rule(".cell[data-end='lift'] .token")).toMatch(/animation:\s*end-lift\s[^;]*backwards/);
    expect(rule(".win-stroke[data-end='stroke'] path")).toMatch(/animation:\s*stroke-draw\s[^;]*backwards/);
    expect(rule(".cell[data-end='dim'] .tile-face::after")).toMatch(/animation:\s*end-veil\s/);
    expect(rule(".cell[data-end='grey'] .tile-face::after")).toMatch(/mix-blend-mode:\s*saturation/);
    expect(rule(".cell[data-end='settle'] .tile-face")).toMatch(/animation:\s*end-settle\s/);
    expect(css).toMatch(/\.board\[data-end-skipped='true'\] \*,\s*\.board\[data-end-skipped='true'\] \*::before,\s*\.board\[data-end-skipped='true'\] \*::after\s*\{\s*animation:\s*none\s*!important/);
    expect(rule('.win-stroke')).toMatch(/pointer-events:\s*none/);
    // The toasts' slot never takes a tap.
    expect(rule('.toasts')).toMatch(/pointer-events:\s*none/);
  });

  it('animates only through CSS, never through script timing the reduced-motion switch cannot reach', () => {
    for (const [file, source] of sources) expect(source, file).not.toMatch(/\.animate\(|requestAnimationFrame|setInterval/);
  });
});

describe('the legal-tile look and the last take (PRD R2, I2)', () => {
  const glowRules = rules.filter(({ selector }) => /data-glow|\.glow\b/.test(selector) && /\.cell/.test(selector));
  const fadedRules = rules.filter(({ selector }) => /data-faded/.test(selector));

  it('lifts a legal tile and washes it in about 15% of the mover’s colour, on a layer of the art, never by an outline or a border', () => {
    expect(rule(".cell[data-glow='true']")).toMatch(/translate:\s*0 -\d+px/);
    expect(rule(".cell[data-glow='true'] .tile-face::before")).toMatch(/background-color:\s*color-mix\(in srgb, var\(--wash\) 1[0-9]%, transparent\)/);
    expect(rule(".board[data-glow-player='A']")).toMatch(/--wash:\s*var\(--p1\)/);
    expect(rule(".board[data-glow-player='B']")).toMatch(/--wash:\s*var\(--p2\)/);
    expect(glowRules.length).toBeGreaterThanOrEqual(2);
    for (const { selector, body } of glowRules) {
      expect(body, selector).not.toMatch(/(^|[;\s])(outline|border)(-[a-z]+)?\s*:/);
      // The mover's colour shows only in the wash layer.
      if (!selector.endsWith('::before')) expect(body, selector).not.toMatch(/var\(--(p1|p2|wash)\)/);
    }
  });

  it('fades the other free tiles to about 55% by a veil over the art, never by opacity on the cell, and only free tiles', () => {
    expect(rule(".cell[data-faded='true'] .tile-face::after")).toMatch(/background-color:\s*color-mix\(in srgb, var\(--ground\) 4[0-9]%, transparent\)/);
    for (const { selector, body } of fadedRules) {
      expect(selector).toMatch(/\.tile-face::(before|after)$/);
      expect(body, selector).not.toMatch(/(^|[;\s])opacity\s*:/);
    }
    // No rule anywhere sets the opacity of a cell itself.
    for (const { selector, body } of rules.filter(({ selector }) => /\.cell(\[[^\]]*\]|\.[a-z-]+)*$/.test(selector))) expect(body, selector).not.toMatch(/(^|[;\s])opacity\s*:/);
  });

  it('keeps the name plate on top of the wash and the veil, on a solid plate, hidden by default and shown on hover, focus, a long press or the setting', () => {
    const plate = rule('.tile-name');
    const layers = rule('.tile-face::before,\n.tile-face::after');
    expect(Number(/z-index:\s*(\d+)/.exec(plate)![1])).toBeGreaterThan(Number(/z-index:\s*(\d+)/.exec(layers)![1]));
    expect(layers).toMatch(/pointer-events:\s*none/);
    expect(plate).toMatch(/display:\s*none/);
    expect(plate).toMatch(/background-color:\s*var\(--chip\)/);
    expect(plate).toMatch(/color:\s*var\(--text\)/);
    const shown = rule(".cell:hover .tile-name,\n.cell:focus-visible .tile-name,\n.cell[data-peek='true'] .tile-name,\n.board[data-names='true'] .tile-name");
    expect(shown).toMatch(/display:\s*flex/);
    // A held press never opens the browser's menu or zooms.
    expect(rule('.cell')).toMatch(/touch-action:\s*manipulation/);
    expect(rule('.cell')).toMatch(/-webkit-touch-callout:\s*none/);
  });

  it('marks the last take with one warm tint, with no dashed box or corner tab', () => {
    expect(rule('.cell.taken.last')).toMatch(/background-color:\s*var\(--recent\)/);
    expect(css).not.toMatch(/last-mark|winning-mark/);
    for (const { selector, body } of rules.filter(({ selector }) => /\.last\b|data-last/.test(selector))) {
      expect(body, selector).not.toMatch(/dashed|outline/);
    }
  });
});

describe('the board’s spacing (PRD U1)', () => {
  it('spaces the tiles by 12% of a tile, with the same padding round them, from one gap variable', () => {
    expect(rule('.board-frame,\n.board')).toMatch(/--gap:\s*calc\(\(var\(--board\) - 2 \* var\(--band\) - 6px\) \* 0\.12 \/ 4\.6\)/);
    expect(rule('.board')).toMatch(/(^|;|\s)gap:\s*var\(--gap\)/);
    expect(rule('.board')).toMatch(/padding:\s*var\(--gap\)/);
    // The frame's border is the 6px the gap allows for.
    expect(rule('.board-frame')).toMatch(/border:\s*3px solid/);
  });

  it('keeps the A–D and 1–4 labels light and small, on the wood', () => {
    const labels = rule('.frame-labels');
    expect(labels).toMatch(/font-weight:\s*[45]00/);
    expect(Number(/font-size:\s*([\d.]+)rem/.exec(labels)![1])).toBeLessThan(0.8);
    expect(labels).toMatch(/color:\s*var\(--on-frame\)/);
  });
});

describe('a calm ground (PRD U1)', () => {
  const groundRules = rules.filter(({ selector }) => selector.split(',').map((part) => part.trim()).some((part) => ['body', '.match', '.home'].includes(part)));

  it('has no felt and no repeating diagonal pattern anywhere', () => {
    expect(css).not.toMatch(/felt/i);
    expect(readFileSync(join(import.meta.dirname, 'theme.ts'), 'utf8')).not.toMatch(/felt/i);
    expect(css).not.toMatch(/repeating-(linear|radial|conic)-gradient\(\s*-?(45|135|225|315)deg/);
    // The detector sees the old weave.
    expect('repeating-linear-gradient(45deg, x 0 1px)').toMatch(/repeating-(linear|radial|conic)-gradient\(\s*-?(45|135|225|315)deg/);
  });

  it('paints the ground of the home screen and the game as layers of the screen itself: solid paper or slate, a glow, a vignette and grain of 3% or less, with no repeating or directional pattern', () => {
    expect(groundRules.length).toBeGreaterThan(0);
    const painted = groundRules.filter(({ body }) => /background-image\s*:/.test(body));
    expect(painted).toHaveLength(1);
    const { selector, body } = painted[0]!;
    for (const screen of ['body', '.match', '.home']) expect(selector).toContain(screen);
    expect(body).toMatch(/background-color:\s*var\(--ground\)/);
    const image = /background-image\s*:\s*([^;]+)/.exec(body)![1]!;
    expect(image).not.toMatch(/repeating-|linear-gradient|conic-gradient/);
    expect(image).toMatch(/var\(--ground-glow\)/);
    expect(image).toMatch(/var\(--ground-edge\)/);
    // The grain: dots mixed at 3% or less, tiled at co-prime sizes.
    const strengths = [...image.matchAll(/color-mix\(in srgb, var\(--(?:shade|shine)\) (\d+(?:\.\d+)?)%/g)].map((match) => Number(match[1]));
    expect(strengths.length).toBeGreaterThanOrEqual(1);
    for (const strength of strengths) expect(strength).toBeLessThanOrEqual(3);
    const sizes = [...(/background-size\s*:\s*([^;]+)/.exec(body)![1]!).matchAll(/(\d+)px \1px/g)].map((match) => Number(match[1]));
    expect(sizes.length).toBe(2);
    const gcd = (a: number, b: number): number => (b === 0 ? a : gcd(b, a % b));
    expect(gcd(sizes[0]!, sizes[1]!)).toBe(1);
    // Nothing is laid over the screens: the ground has no pseudo-element overlay.
    expect(rules.some(({ selector: other }) => /(^|,\s*)(body|\.match|\.home)::(before|after)/.test(other))).toBe(false);
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
