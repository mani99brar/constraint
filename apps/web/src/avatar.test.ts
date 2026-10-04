import { describe, expect, it } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { Avatar } from './Avatar';
import { EXPRESSIONS, REACTIONS, type Expression, type Reaction } from './reactions';

// The two fixed avatars (PRD U1, U9, §5.8): five resting faces, four one-shot reactions, shaded in place.

const render = (player: 'A' | 'B', expression: Expression, reaction: Reaction | null = null, reactionKey = 0) =>
  renderToStaticMarkup(createElement(Avatar, { player, expression, reaction, reactionKey }));

describe('avatars (PRD U1, U9)', () => {
  it.each(['A', 'B'] as const)('draws player %s’s avatar with each of its five faces, each different', (player) => {
    const faces = EXPRESSIONS.map((expression) => render(player, expression));
    expect(EXPRESSIONS).toEqual(['idle', 'to-move', 'thinking', 'won', 'lost']);
    EXPRESSIONS.forEach((expression, index) => {
      const html = faces[index]!;
      expect(html).toContain(`data-expression="${expression}"`);
      expect(html).toContain(`data-face="${expression}"`);
      expect(html).toContain(`data-testid="avatar-${player}"`);
      expect(html).toContain('aria-hidden="true"');
      expect(html).toMatch(/^<svg[^>]*viewBox="0 0 64 64"/);
      expect(html).not.toMatch(/<image|<text|href=|<defs|url\(#| id="/);
    });
    const faceOnly = faces.map((html) => /<g class="face"[\s\S]*<\/g>/.exec(html)![0]);
    expect(new Set(faceOnly).size).toBe(5);
  });

  it.each(['A', 'B'] as const)('renders every reaction on player %s’s avatar, keyed by the event count, and none by default', (player) => {
    expect(REACTIONS).toEqual(['nod', 'glance', 'wince', 'bounce']);
    for (const reaction of REACTIONS) {
      const html = render(player, reaction === 'bounce' ? 'won' : 'idle', reaction, 7);
      expect(html).toMatch(new RegExp(`^<svg[^>]*data-reaction="${reaction}"[^>]*data-reaction-key="7"`));
      expect(html).toContain(`<g class="avatar-motion" data-motion="${reaction}">`);
    }
    const still = render(player, 'idle');
    expect(still).not.toContain('data-reaction=');
    expect(still).toContain('data-reaction-key="0"');
    expect(still).toContain('<g class="avatar-motion">');
  });

  it('shades each figure with extra paths at partial opacity after its solid body fill', () => {
    for (const player of ['A', 'B'] as const) {
      const html = render(player, 'idle');
      // The first path is the body in the player's solid colour; the shading comes after it.
      expect(/<path[^>]*>/.exec(html)![0]).toContain(`fill="var(--p${player === 'A' ? 1 : 2})"`);
      const shading = [...html.matchAll(/<[a-z]+ [^>]*data-shading="(shade|shine)"[^>]*>/g)];
      expect(shading.length).toBeGreaterThanOrEqual(3);
      for (const [element] of shading) expect(Number(/opacity="([\d.]+)"/.exec(element)![1])).toBeLessThan(1);
      expect(html.indexOf('data-shading')).toBeGreaterThan(html.indexOf(`var(--p${player === 'A' ? 1 : 2})`));
    }
  });

  it('gives the two players different figures', () => {
    const one = render('A', 'idle');
    const two = render('B', 'idle');
    expect(one).toContain('data-avatar="cap"');
    expect(two).toContain('data-avatar="hood"');
    expect(one.replace(/data-[a-z-]+="[^"]*"/g, '')).not.toBe(two.replace(/data-[a-z-]+="[^"]*"/g, ''));
  });
});
