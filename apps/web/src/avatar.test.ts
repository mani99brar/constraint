import { describe, expect, it } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { Avatar } from './Avatar';
import { EXPRESSIONS } from './seats';

// The two fixed avatars (PRD U1, §5.8), each with four expressions.

const render = (player: 'A' | 'B', expression: (typeof EXPRESSIONS)[number]) => renderToStaticMarkup(createElement(Avatar, { player, expression }));

describe('avatars (PRD U1)', () => {
  it.each(['A', 'B'] as const)('draws player %s’s avatar with each of its four expressions, each different', (player) => {
    const faces = EXPRESSIONS.map((expression) => render(player, expression));
    expect(EXPRESSIONS).toEqual(['idle', 'to-move', 'won', 'lost']);
    EXPRESSIONS.forEach((expression, index) => {
      const html = faces[index]!;
      expect(html).toContain(`data-expression="${expression}"`);
      expect(html).toContain(`data-face="${expression}"`);
      expect(html).toContain(`data-testid="avatar-${player}"`);
      expect(html).toContain('aria-hidden="true"');
      expect(html).toMatch(/^<svg[^>]*viewBox="0 0 64 64"/);
      expect(html).not.toMatch(/<image|<text|href=/);
    });
    const faceOnly = faces.map((html) => /<g class="face"[\s\S]*<\/g>/.exec(html)![0]);
    expect(new Set(faceOnly).size).toBe(4);
  });

  it('gives the two players different figures', () => {
    const one = render('A', 'idle');
    const two = render('B', 'idle');
    expect(one).toContain('data-avatar="cap"');
    expect(two).toContain('data-avatar="hood"');
    expect(one.replace(/data-[a-z]+="[^"]*"/g, '')).not.toBe(two.replace(/data-[a-z]+="[^"]*"/g, ''));
  });
});
