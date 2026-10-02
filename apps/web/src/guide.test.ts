import { describe, expect, it } from 'vitest';
import { OBJECTIVES } from '@okiya/content';
import { GUIDE_KEY, guideStartsOpen, guideSteps, objectiveSummary, rememberDismissed, type GuideStorage } from './guide';

function memoryStorage(): GuideStorage & { readonly data: Map<string, string> } {
  const data = new Map<string, string>();
  return { data, getItem: (key) => data.get(key) ?? null, setItem: (key, value) => void data.set(key, value) };
}

const throwing: GuideStorage = {
  getItem: () => {
    throw new Error('SecurityError');
  },
  setItem: () => {
    throw new Error('QuotaExceededError');
  },
};

describe('onboarding guide state (PRD U7)', () => {
  it('starts open on a first visit', () => {
    expect(guideStartsOpen(memoryStorage())).toBe(true);
  });

  it('stays dismissed once dismissed', () => {
    const storage = memoryStorage();
    expect(rememberDismissed(storage)).toBe(true);
    expect(storage.data.get(GUIDE_KEY)).toBe('true');
    expect(guideStartsOpen(storage)).toBe(false);
    expect(guideStartsOpen(storage)).toBe(false);
  });

  it('survives a storage that throws, and one that is missing', () => {
    expect(guideStartsOpen(throwing)).toBe(true);
    expect(() => rememberDismissed(throwing)).not.toThrow();
    expect(rememberDismissed(throwing)).toBe(false);
    expect(guideStartsOpen(null)).toBe(true);
    expect(rememberDismissed(null)).toBe(false);
  });

  it('explains matching, the fighters and the objective in words from its summary', () => {
    const steps = guideSteps('Square');
    expect(steps.map((step) => step.id)).toEqual(['matching', 'fighters', 'objective']);
    expect(steps[0]!.text).toContain('terrain or that symbol');
    expect(steps[1]!.text).toContain('highlighted cells');
    const square = OBJECTIVES.find((objective) => objective.id === 'Square')!;
    expect(objectiveSummary('Square')).toBe(square.summary);
    expect(steps[2]!.text).toContain(square.summary);
  });
});
