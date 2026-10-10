import { useEffect, useState } from 'react';

/**
 * Telling a player that the page they are looking at is out of date. A phone keeps tabs open for days and
 * a static host lets browsers cache the page for minutes, so a tab can keep running an old build after a
 * new one is published. The page names its script by content hash (assets/index-<hash>.js); the app
 * asks the host for the current page, compares the two names and offers a reload when they differ.
 */

const ASSET = /assets\/index-[\w-]+\.js/;

/** The script this page is running, by its hashed file name; null in development, where scripts are not hashed. */
export function runningAsset(scripts: Iterable<{ readonly src: string }>): string | null {
  for (const { src } of scripts) {
    const found = ASSET.exec(src);
    if (found) return found[0];
  }
  return null;
}

/** The script the served page names; null when it names none. */
export function servedAsset(html: string): string | null {
  return ASSET.exec(html)?.[0] ?? null;
}

/** Whether the served page names a different script from the one running; never when either is unknown. */
export function isStale(running: string | null, served: string | null): boolean {
  return running !== null && served !== null && running !== served;
}

/** True once the host serves a newer build than this page runs; checked at start and whenever the tab becomes visible again. */
export function useUpdateReady(): boolean {
  const [ready, setReady] = useState(false);
  useEffect(() => {
    const running = runningAsset(document.querySelectorAll<HTMLScriptElement>('script[src]'));
    if (running === null) return;
    let cancelled = false;
    const check = async () => {
      try {
        const response = await fetch(`./?update-check=${Date.now()}`, { cache: 'no-store' });
        if (!response.ok) return;
        if (!cancelled && isStale(running, servedAsset(await response.text()))) setReady(true);
      } catch {
        // Offline or blocked: no notice.
      }
    };
    const timer = window.setTimeout(check, 2000);
    const onVisible = () => {
      if (!document.hidden) void check();
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, []);
  return ready;
}
