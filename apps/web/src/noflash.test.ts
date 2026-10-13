/// <reference types="node" />
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { DEFAULT_SETTINGS, SETTINGS_KEY } from './settings';
import { DEFAULT_PALETTE, PALETTE_IDS } from './theme';

// The colour theme before the first paint (PRD U5): index.html's inline script reads the stored settings
// and sets data-palette on the root before any app script runs, so no other theme flashes first.

const html = readFileSync(join(import.meta.dirname, '..', 'index.html'), 'utf8');
const scripts = [...html.matchAll(/<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/g)].map((match) => match[1]!);
const script = scripts[0]!;

/** Runs the inline script against a fake storage and root, and returns the data-palette it set. */
function runScript(stored: string | null | (() => never)): string | null {
  const attributes = new Map<string, string>();
  const window = {
    localStorage: {
      getItem: (key: string) => {
        if (typeof stored === 'function') return stored();
        return key === SETTINGS_KEY ? stored : null;
      },
    },
  };
  const document = { documentElement: { setAttribute: (name: string, value: string) => void attributes.set(name, value) } };
  new Function('window', 'document', script)(window, document);
  return attributes.get('data-palette') ?? null;
}

describe('the no-flash theme script (PRD U5)', () => {
  it('is one inline classic script in the head, before the app’s module script', () => {
    expect(scripts).toHaveLength(1);
    const head = html.slice(0, html.indexOf('</head>'));
    expect(head).toContain(script);
    expect(html.indexOf(script)).toBeLessThan(html.indexOf('type="module"'));
    expect(html).toMatch(/<script>\s/);
  });

  it('reads the settings’ own key and knows exactly the palette ids of the client, default first', () => {
    expect(script).toContain(`'${SETTINGS_KEY}'`);
    const listed = /var palettes = \[([^\]]*)\]/.exec(script)![1]!.split(',').map((part) => part.trim().replace(/'/g, ''));
    expect(listed).toEqual([...PALETTE_IDS]);
    expect(listed[0]).toBe(DEFAULT_PALETTE);
  });

  it.each(PALETTE_IDS)('sets data-palette to the stored %s theme', (palette) => {
    expect(runScript(JSON.stringify({ ...DEFAULT_SETTINGS, palette }))).toBe(palette);
  });

  it('sets the default theme for missing, older, unknown and malformed settings, and when storage throws', () => {
    expect(runScript(null)).toBe(DEFAULT_PALETTE);
    expect(runScript(JSON.stringify({ highlights: true, sound: false }))).toBe(DEFAULT_PALETTE);
    expect(runScript(JSON.stringify({ palette: 'teal' }))).toBe(DEFAULT_PALETTE);
    expect(runScript(JSON.stringify({ palette: 7 }))).toBe(DEFAULT_PALETTE);
    expect(runScript('{"palette":"clear"')).toBe(DEFAULT_PALETTE);
    expect(runScript('null')).toBe(DEFAULT_PALETTE);
    expect(runScript('"clear"')).toBe(DEFAULT_PALETTE);
    expect(
      runScript(() => {
        throw new Error('SecurityError');
      }),
    ).toBe(DEFAULT_PALETTE);
  });
});
