import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { describe, expect, it } from 'vitest';

// `packages/game`, `packages/rules`, `packages/content` and `packages/bot` are pure (CLAUDE.md, PRD §7): no DOM, rendering or
// network libraries, no timers, no wall-clock time and no Math.random.

const root = join(import.meta.dirname, '..', '..');

const FORBIDDEN: readonly { readonly name: string; readonly pattern: RegExp }[] = [
  { name: 'Math.random', pattern: /\bMath\s*\.\s*random\b/ },
  { name: 'wall-clock time', pattern: /\bDate\s*\.\s*now\b|\bnew\s+Date\b|\bperformance\s*\.\s*now\b/ },
  { name: 'timers', pattern: /\b(setTimeout|setInterval|setImmediate|requestAnimationFrame|queueMicrotask)\s*\(|['"](node:)?timers(\/promises)?['"]/ },
  { name: 'DOM globals', pattern: /\b(window|document|navigator|localStorage|sessionStorage)\s*\./ },
  { name: 'network', pattern: /\bfetch\s*\(|\bXMLHttpRequest\b|\bWebSocket\b|['"](node:)?(http|https|net|dgram|tls)['"]/ },
  { name: 'DOM, rendering or network libraries', pattern: /from\s+['"](react|react-dom|vite|jsdom|happy-dom|axios|ws|node-fetch|undici)(\/[^'"]*)?['"]/ },
];

const ALLOWED_DEPENDENCIES: Record<string, readonly string[]> = {
  game: ['pure-rand'],
  rules: ['pure-rand'],
  content: ['@okiya/rules'],
  bot: ['@okiya/game', '@okiya/rules', 'pure-rand'],
};

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return sourceFiles(path);
    return /\.tsx?$/.test(name) ? [path] : [];
  });
}

function violations(source: string): string[] {
  const code = source.replace(/\/\*[\s\S]*?\*\/|\/\/.*$/gm, '');
  return FORBIDDEN.filter(({ pattern }) => pattern.test(code)).map(({ name }) => name);
}

describe('purity of the authoritative packages', () => {
  it('detects each forbidden kind of import or call', () => {
    expect(violations('const x = Math.random();')).toEqual(['Math.random']);
    expect(violations('const t = Date.now();')).toEqual(['wall-clock time']);
    expect(violations('setTimeout(() => 1, 5);')).toEqual(['timers']);
    expect(violations('document.title = "x";')).toEqual(['DOM globals']);
    expect(violations("import http from 'node:http';")).toEqual(['network']);
    expect(violations("import { useState } from 'react';")).toEqual(['DOM, rendering or network libraries']);
    expect(violations('// Math.random is mentioned in a comment only')).toEqual([]);
  });

  for (const pkg of ['game', 'rules', 'content', 'bot']) {
    it(`holds for packages/${pkg}`, () => {
      const dir = join(root, 'packages', pkg);
      const files = sourceFiles(join(dir, 'src'));
      expect(files.length).toBeGreaterThan(0);
      const found = files.flatMap((file) => violations(readFileSync(file, 'utf8')).map((name) => `${relative(root, file)}: ${name}`));
      expect(found).toEqual([]);
      const manifest = JSON.parse(readFileSync(join(dir, 'package.json'), 'utf8')) as { dependencies?: Record<string, string> };
      expect(Object.keys(manifest.dependencies ?? {})).toEqual(ALLOWED_DEPENDENCIES[pkg]);
    });
  }
});
