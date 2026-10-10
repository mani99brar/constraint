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
/** The scenes' motion inside the tiles: the only animations that loop, each in the no-preference block. */
const isIdleRule = (selector: string) => /^\.board \.cell \.sc-/.test(selector);
const idleRules = rules.filter(({ selector }) => isIdleRule(selector));
const otherRules = rules.filter(({ selector }) => !isEndRule(selector) && !isIdleRule(selector));

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

describe('the motion inside the tile art', () => {
  it('lives only in the no-preference block, moves by transform and opacity alone, each tile on its own phase, and never touches the legal highlight', () => {
    expect(idleRules.length).toBeGreaterThanOrEqual(8);
    const block = /@media\s*\(prefers-reduced-motion:\s*no-preference\)\s*\{([\s\S]*?)\n\}\n/.exec(css)?.[1] ?? '';
    for (const { selector } of idleRules) expect(block, selector).toContain(selector);
    for (const name of ['scene-roll', 'scene-bob', 'scene-drift', 'scene-sway', 'scene-pulse', 'scene-flicker']) {
      const body = new RegExp(`@keyframes ${name}\\s*\\{((?:[^{}]*\\{[^{}]*\\})*)\\s*\\}`).exec(css)?.[1] ?? '';
      expect(body, name).not.toBe('');
      const properties = [...body.matchAll(/([a-z-]+)\s*:/g)].map((match) => match[1]);
      for (const property of properties) expect(['transform', 'opacity'], `${name} animates ${property}`).toContain(property);
    }
    // Every scene animation sits on a board cell's own part of the art, with a negative delay by the cell's index.
    for (const { selector, body } of idleRules) {
      expect(selector, selector).toMatch(/^\.board \.cell \.sc-/);
      if (/animation-delay/.test(body)) expect(body, selector).toMatch(/animation-delay:\s*calc\(var\(--i, 0\) \* -\d/);
    }
    // The scenes rest while the tab is hidden; the card has no sweep over it, and the highlight no loop.
    expect(css).toMatch(/:root\[data-hidden\] \.board \.cell \.scene \* \{\s*animation-play-state:\s*paused/);
    expect(css).not.toMatch(/idle-shimmer|idle-drift|legal-breathe/);
    expect(rule(".cell[data-glow='true'] .tile-face::before")).not.toMatch(/animation/);
  });
});

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
    const fade = /animation:\s*match-fade\s+([^;]+)/.exec(rule('.match-text'))?.[1] ?? '';
    expect(times(fade)[0]).toBeLessThan(200);
    expect(rule('.terrain-thumb')).not.toMatch(/animation/);
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
  const glowRules = rules.filter(({ selector }) => /data-glow/.test(selector) && /\.cell/.test(selector));
  const fadedRules = rules.filter(({ selector }) => /data-faded/.test(selector));

  it('raises a legal tile with a halo of the mover’s colour reaching a third of the gap at most, a 3 px ring and a 30% tint inside the art', () => {
    expect(rule(".board[data-glow-player='A']")).toMatch(/--wash:\s*var\(--p1\)/);
    expect(rule(".board[data-glow-player='B']")).toMatch(/--wash:\s*var\(--p2\)/);
    const glow = rule(".cell[data-glow='true']");
    expect(glow).toMatch(/(^|;|\s)translate:\s*0 -\d+px/);
    // The ring: the cell's 1 px border and the tint layer's 2 px inset edge, both in the mover's colour.
    expect(glow).toMatch(/border-color:\s*var\(--wash\)/);
    expect(rule('.cell')).toMatch(/border:\s*1px solid/);
    const layer = rule(".cell[data-glow='true'] .tile-face::before");
    expect(layer).toMatch(/box-shadow:\s*inset 0 0 0 2px var\(--wash\)/);
    expect(layer).toMatch(/background-color:\s*color-mix\(in srgb, var\(--wash\) ([6-9]|1[0-2])%, transparent\)/);
    // The halo: the first shadow, its blur and spread together a third of the gap at most.
    const shadows = /box-shadow:\s*([^;]+)/.exec(glow)![1]!;
    let depth = 0;
    const cut = [...shadows].findIndex((char) => (depth += char === '(' ? 1 : char === ')' ? -1 : 0) === 0 && char === ',');
    const halo = shadows.slice(0, cut);
    expect(halo).toContain('var(--wash)');
    const shares = [...halo.matchAll(/calc\(var\(--gap\) \/ (\d+)\)/g)].map((match) => 1 / Number(match[1]));
    expect(shares).toHaveLength(2);
    expect(shares[0]! + shares[1]!).toBeLessThanOrEqual(1 / 3 + 1e-9);
    // No outline anywhere on a glowing tile.
    for (const { selector, body } of glowRules) expect(body, selector).not.toMatch(/(^|[;\s])outline(-[a-z]+)?\s*:/);
  });

  it('puts the mover’s token mark on a corner badge in the mover’s colour, above the tint and below the name plate', () => {
    const badge = rule('.move-badge');
    expect(badge).toMatch(/background-color:\s*var\(--wash\)/);
    expect(badge).toMatch(/color:\s*var\(--on-wash\)/);
    expect(badge).toMatch(/pointer-events:\s*none/);
    const z = (body: string) => Number(/z-index:\s*(\d+)/.exec(body)![1]);
    expect(z(badge)).toBeGreaterThan(z(rule('.tile-face::before,\n.tile-face::after')));
    expect(rule(".board[data-glow-player='A']")).toMatch(/--on-wash:\s*var\(--on-p1\)/);
    expect(rule(".board[data-glow-player='B']")).toMatch(/--on-wash:\s*var\(--on-p2\)/);
  });

  it('pops the legal tiles once per turn by two identical keyframes picked by the turn’s parity, under 400 ms in all, with static delays by order that the parity rules never reset', () => {
    const odd = ".board[data-pop-turn='odd'] .cell[data-glow='true']";
    const even = ".board[data-pop-turn='even'] .cell[data-glow='true']";
    // The parity rules set only the animation's name, never the shorthand that would reset the delay.
    expect(rule(odd).trim()).toMatch(/^animation-name:\s*pop-odd;?$/);
    expect(rule(even).trim()).toMatch(/^animation-name:\s*pop-even;?$/);
    const keyframes = (name: string) => new RegExp(`@keyframes ${name}\\s*\\{((?:[^{}]*\\{[^{}]*\\})*)[^{}]*\\}`).exec(css)?.[1]?.replace(/\s+/g, ' ');
    expect(keyframes('pop-odd')).toBeDefined();
    expect(keyframes('pop-odd')).toBe(keyframes('pop-even'));
    expect(keyframes('pop-odd')).toMatch(/from \{ translate: 0 0;/);
    // The glowing cell: the pop's duration, filling backwards so a waiting tile stays down, and no transition
    // that would move the delayed tiles together.
    const glow = rule(".cell[data-glow='true']");
    expect(glow).toMatch(/animation-fill-mode:\s*backwards/);
    expect(glow).toMatch(/(^|;|\s)transition:\s*none/);
    expect(glow).not.toMatch(/(^|;|\s)animation:/);
    const duration = times(/animation-duration:\s*([^;]+)/.exec(glow)![1]!)[0]!;
    // One static delay per data-pop-order, up to the 12 edge tiles of the opening, later than the parity
    // rules and at least as specific, never computed from a variable.
    const orderRules = rules
      .map((candidate, index) => ({ ...candidate, index, order: /\[data-pop-order='(\d+)'\]/.exec(candidate.selector)?.[1] }))
      .filter((candidate) => candidate.order !== undefined);
    expect(orderRules.map((candidate) => Number(candidate.order))).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]);
    const specificity = (selector: string) => (selector.match(/\.[a-z-]+|\[[^\]]+\]/g) ?? []).length;
    const parityIndex = Math.max(...[odd, even].map((selector) => rules.findIndex((candidate) => candidate.selector === selector)));
    const delays = orderRules.map(({ selector, body, index }) => {
      expect(index, selector).toBeGreaterThan(parityIndex);
      expect(specificity(selector), selector).toBeGreaterThanOrEqual(specificity(odd));
      expect(body.trim(), selector).toMatch(/^animation-delay:\s*\d+ms;?$/);
      return times(body)[0]!;
    });
    expect(delays.every((delay, index) => index === 0 || delay > delays[index - 1]!)).toBe(true);
    expect(new Set(delays).size).toBe(11);
    expect(Math.max(...delays) + duration).toBeLessThan(400);
    // The pop has static delays only; the scenes' calc() delays (by tile index) belong to the art inside the tiles alone.
    expect(css.replace(/animation-delay:\s*calc\(var\(--i, 0\) \* -[\d.]+s( - \d+s)?\)/g, "")).not.toMatch(/animation-delay:\s*calc\(/);
  });

  it('fades the other free tiles by a veil of the ground over the art, never by opacity on the cell, and only free tiles', () => {
    expect(rule(".cell[data-faded='true'] .tile-face::after")).toMatch(/background-color:\s*color-mix\(in srgb, var\(--ground\) ([23]\d)%, transparent\)/);
    for (const { selector, body } of fadedRules) {
      expect(selector).toMatch(/\.tile-face::(before|after)$/);
      expect(body, selector).not.toMatch(/(^|[;\s])opacity\s*:/);
    }
    // No rule anywhere sets the opacity of a cell itself.
    for (const { selector, body } of rules.filter(({ selector }) => /\.cell(\[[^\]]*\]|\.[a-z-]+)*$/.test(selector))) expect(body, selector).not.toMatch(/(^|[;\s])opacity\s*:/);
  });

  it('keeps the name plate on top of the tint, the badge and the veil, on a solid plate, hidden by default and shown on hover, focus, a long press or the setting', () => {
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

  it('marks the last take with a soft ring in its taker’s colour on its sunken slot, with no tint, dashed box or corner tab', () => {
    expect(rule(".cell.taken.last[data-owner='A']")).toMatch(/box-shadow:\s*inset 0 0 0 2px var\(--p1\),\s*inset 0 0 \d+px \d+px color-mix\(in srgb, var\(--p1\)/);
    expect(rule(".cell.taken.last[data-owner='B']")).toMatch(/box-shadow:\s*inset 0 0 0 2px var\(--p2\),\s*inset 0 0 \d+px \d+px color-mix\(in srgb, var\(--p2\)/);
    expect(rule('.cell.taken')).toMatch(/background-color:\s*var\(--slot\)/);
    expect(css).not.toMatch(/--recent|--legal|last-mark|winning-mark/);
    for (const { selector, body } of rules.filter(({ selector }) => /\.last\b|data-last/.test(selector))) {
      expect(body, selector).not.toMatch(/dashed|outline|background-color/);
    }
  });

  it('draws no whose-turn stripe on the board frame or the well', () => {
    expect(css).not.toMatch(/data-active/);
    expect(rule('.board')).toMatch(/background-color:\s*var\(--well\)/);
  });
});

describe('the phone’s end shrink (PRD U6, U8, U10)', () => {
  it('sizes the board from one registered length, set in every layout, that the board’s drawing reads', () => {
    expect(css).toMatch(/@property --board-size\s*\{\s*syntax:\s*'<length>';\s*inherits:\s*true;\s*initial-value:\s*0px;\s*\}/);
    expect(rule('.match')).toMatch(/--board-size:\s*min\(/);
    expect(rule('.match')).toMatch(/--board:\s*var\(--board-size\)/);
    expect(rule('.board-frame')).toMatch(/width:\s*var\(--board\)/);
    // The toasts' room is a length of its own: --slot stays the sunken slot's colour.
    expect(css).not.toMatch(/--slot:\s*\d/);
    expect(css).toMatch(/--toast-room:\s*\d+px/);
  });

  it('derives the ended size from the mid-game rows, clamped between 44 px tiles and the mid-game board, and clips the column while it shrinks', () => {
    const phone = /@media \(max-width: 760px\) \{([\s\S]*?)\n\}/.exec(css)![1]!;
    const block = /\.match \{([^}]*)\}/.exec(phone)![1]!;
    expect(block).toMatch(/--board-size:\s*var\(--board-mid\)/);
    // The spacers come from the static mid-game board, never the animated size.
    expect(block).toMatch(/--free:[^;]*var\(--board-mid\)/);
    expect(block).toMatch(/--spacer:[^;]*var\(--free\)/);
    expect(block).not.toMatch(/--(spacer|free):[^;]*var\(--board-size\)/);
    // The gap under the board never drops below the one-line toast's height (short phones).
    expect(block).toMatch(/--toast-gap:\s*max\(var\(--toast-line\),\s*var\(--spacer\)\)/);
    expect(block).toMatch(/--seat-gap:\s*var\(--toast-gap\)/);
    expect(block).toMatch(/--board-end:\s*clamp\(\s*var\(--min-board\),[\s\S]*var\(--end-card\),\s*var\(--board-mid\)\s*\)/);
    expect(block).toMatch(/--min-board:\s*calc\(44px \* 4\.6/);
    const ended = /\.match\.ended \{([^}]*)\}/.exec(phone)![1]!;
    expect(ended).toMatch(/--board-size:\s*var\(--board-end\)/);
    expect(ended).toMatch(/--seat-gap:\s*var\(--end-gap\)/);
    expect(ended).not.toMatch(/transition|overflow/);
    // Clipped to the screen only while the shrink runs; a very short phone may scroll to the card after it.
    const shrinking = /\.match\.ended\[data-end-shrinking\] \{([^}]*)\}/.exec(phone)![1]!;
    expect(shrinking).toMatch(/overflow:\s*clip/);
    expect(shrinking).toMatch(/height:\s*100dvh/);
  });

  it('transitions the board’s size only while the end sequence runs on a phone with motion allowed, within 300 ms, and never the frame’s width or height', () => {
    const transitions = rules.filter(({ body }) => /--board-size/.test(/transition[^:]*:\s*([^;]+)/.exec(body)?.[1] ?? ''));
    expect(transitions.map(({ selector }) => selector)).toEqual(['.match.ended[data-end-shrinking]']);
    const scoped = /@media \(max-width: 760px\) and \(prefers-reduced-motion: no-preference\) \{\s*\.match\.ended\[data-end-shrinking\] \{\s*transition:\s*([^;]+);\s*\}\s*\}/.exec(css);
    expect(scoped).not.toBeNull();
    expect(scoped![1]).toMatch(/^--board-size \d+ms/);
    expect(times(scoped![1]!)[0]).toBeLessThanOrEqual(300);
    expect(times(scoped![1]!)[0]).toBeGreaterThanOrEqual(200);
    // Player 1's gap eases with the board, on the same timing, so the nameplate never snaps.
    expect(scoped![1]).toMatch(/--seat-gap \d+ms/);
    const [board, gap] = times(scoped![1]!);
    expect(gap).toBe(board);
    expect(css).toMatch(/@property --seat-gap \{\s*syntax: '<length>';\s*inherits: true;/);
    for (const { selector, body } of rules) expect(/transition[^:]*:[^;]*\b(width|height)\b/.test(body), selector).toBe(false);
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

  it('draws no A–D or 1–4 labels round the board', () => {
    expect(css).not.toContain('.frame-labels');
    expect(css).not.toContain('.frame-columns');
    expect(css).not.toContain('.frame-rows');
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
