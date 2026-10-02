import { describe, expect, it } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { FIGHTERS, OBJECTIVES } from '@okiya/content';
import { restoreFocus, wrapFocus, type Focusable } from './focus';
import { HowToPlay } from './HowToPlay';
import { HOWTO_SEEN_KEY, howToOpensFirst, howToSections, objectiveSummary, rememberHowToSeen } from './howto';
import type { KeyValueStorage } from './storage';

function decode(html: string): string {
  return html.replaceAll('&#x27;', "'").replaceAll('&amp;', '&').replaceAll('&quot;', '"');
}

function memoryStorage(): KeyValueStorage & { readonly data: Map<string, string> } {
  const data = new Map<string, string>();
  return { data, getItem: (key) => data.get(key) ?? null, setItem: (key, value) => void data.set(key, value), removeItem: (key) => void data.delete(key) };
}

const html = decode(renderToStaticMarkup(createElement(HowToPlay, { onClose: () => {}, returnFocusTo: null })));

describe('How to Play content (PRD E3)', () => {
  it('is a labelled modal dialog with a close button', () => {
    expect(html).toContain('role="dialog"');
    expect(html).toContain('aria-modal="true"');
    expect(html).toContain('aria-labelledby="howto-title"');
    expect(html).toContain('aria-label="Close How to play"');
  });

  it('explains matching: terrain or symbol, with an example of each case', () => {
    const matching = howToSections().find((section) => section.id === 'matching')!;
    expect(matching.paragraphs.join(' ')).toContain('same terrain or the same symbol');
    expect(html).toContain('data-section="matching"');
    expect(html).toContain('Constraint: <strong>Forest or Moon</strong>');
    expect(html).toContain('✓ matches (same terrain)');
    expect(html).toContain('✓ matches (same symbol)');
    expect(html).toContain('✗ no match (neither)');
    expect(html).toContain('outside edge');
  });

  it('covers every fighter of FIGHTERS with its name and summary', () => {
    for (const fighter of FIGHTERS) {
      expect(html).toContain(`data-fighter="${fighter.type}"`);
      expect(html).toContain(`<strong>${fighter.name}</strong>`);
      expect(html).toContain(fighter.summary);
    }
  });

  it('explains the objective from OBJECTIVES', () => {
    for (const objective of OBJECTIVES) {
      const rendered = decode(renderToStaticMarkup(createElement(HowToPlay, { objective: objective.id, onClose: () => {}, returnFocusTo: null })));
      expect(rendered).toContain(`Goal: ${objective.name}`);
      expect(rendered).toContain(objective.summary);
      expect(objectiveSummary(objective.id)).toBe(objective.summary);
    }
    expect(html).toContain('2×2');
  });

  it('opens by itself only on the very first visit, and not when storage fails', () => {
    const storage = memoryStorage();
    expect(howToOpensFirst(storage)).toBe(true);
    expect(rememberHowToSeen(storage)).toBe(true);
    expect(storage.data.get(HOWTO_SEEN_KEY)).toBe('true');
    expect(howToOpensFirst(storage)).toBe(false);
    expect(howToOpensFirst(null)).toBe(false);
  });
});

describe('How to Play focus (PRD U3, E3)', () => {
  const [close, body, gotIt] = ['close', 'body', 'got-it'];
  const items = [close, body, gotIt];

  it('traps Tab inside the dialog in both directions', () => {
    expect(wrapFocus(items, gotIt, false)).toBe(close);
    expect(wrapFocus(items, close, true)).toBe(gotIt);
    expect(wrapFocus(items, close, false)).toBeNull();
    expect(wrapFocus(items, body, true)).toBeNull();
    expect(wrapFocus(items, 'outside', false)).toBe(close);
    expect(wrapFocus(items, null, true)).toBe(gotIt);
    expect(wrapFocus([], close, false)).toBeNull();
  });

  it('returns focus to the button that opened it, when still on the page', () => {
    const focused: string[] = [];
    const opener: Focusable = { isConnected: true, focus: () => void focused.push('opener') };
    expect(restoreFocus(opener)).toBe(true);
    expect(focused).toEqual(['opener']);
    expect(restoreFocus({ isConnected: false, focus: () => void focused.push('gone') })).toBe(false);
    expect(restoreFocus(null)).toBe(false);
    expect(focused).toEqual(['opener']);
  });
});
