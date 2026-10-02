import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

// Under reduced motion no animation or transition plays (PRD U8). The stylesheet holds the only switch.

const css = readFileSync(join(import.meta.dirname, 'styles.css'), 'utf8');

describe('reduced motion (PRD U8)', () => {
  it('turns off every animation and transition, pseudo-elements included', () => {
    const block = /@media\s*\(prefers-reduced-motion:\s*reduce\)\s*\{([\s\S]*?\})\s*\}/.exec(css)?.[1] ?? '';
    expect(block).toMatch(/\*\s*,\s*\*::before\s*,\s*\*::after\s*\{/);
    expect(block).toMatch(/animation:\s*none\s*!important/);
    expect(block).toMatch(/transition:\s*none\s*!important/);
  });
});
