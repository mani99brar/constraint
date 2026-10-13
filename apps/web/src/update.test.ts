import { describe, expect, it } from 'vitest';
import { isStale, runningAsset, servedAsset } from './update';

describe('the update notice', () => {
  const page = (hash: string) => `<script type="module" crossorigin src="./assets/index-${hash}.js"></script><link rel="stylesheet" href="./assets/index-abc.css">`;

  it('reads the hashed script name from the running page and from the served one', () => {
    expect(runningAsset([{ src: 'https://example.github.io/constraint/assets/index-Bp-JTA2Q.js' }])).toBe('assets/index-Bp-JTA2Q.js');
    expect(servedAsset(page('Bp-JTA2Q'))).toBe('assets/index-Bp-JTA2Q.js');
    expect(runningAsset([{ src: 'http://127.0.0.1:5493/src/main.tsx' }])).toBeNull();
    expect(servedAsset('<html></html>')).toBeNull();
  });

  it('is stale only when both names are known and differ', () => {
    expect(isStale('assets/index-old.js', servedAsset(page('new')))).toBe(true);
    expect(isStale('assets/index-new.js', servedAsset(page('new')))).toBe(false);
    expect(isStale(null, servedAsset(page('new')))).toBe(false);
    expect(isStale('assets/index-old.js', null)).toBe(false);
  });
});
