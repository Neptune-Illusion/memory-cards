import { describe, expect, it, vi } from 'vitest';
import { Store, type Persistence } from '../src/store';
import { computeStats, computeStreak } from '../src/stats';
import { createState } from '../src/scheduler';
import { GRADE, DEFAULT_SETTINGS, type CardState, type ReviewLogEntry } from '../src/types';

const NOW = new Date('2026-08-13T08:00:00.000Z');

function fakePersistence(initial: unknown = null): Persistence & { saved: unknown[] } {
  const saved: unknown[] = [];
  return {
    saved,
    loadData: async () => initial,
    saveData: async (data) => {
      saved.push(JSON.parse(JSON.stringify(data)));
    },
  };
}

describe('Store', () => {
  it('falls back to defaults when there is no saved data', async () => {
    const store = new Store(fakePersistence());
    await store.load();
    expect(store.settings).toEqual(DEFAULT_SETTINGS);
    expect(store.states).toEqual({});
  });

  it('merges saved settings over defaults so new keys appear', async () => {
    const store = new Store(fakePersistence({ settings: { dailyLimit: 5 }, states: {} }));
    await store.load();
    expect(store.settings.dailyLimit).toBe(5);
    expect(store.settings.minThinkSeconds).toBe(DEFAULT_SETTINGS.minThinkSeconds);
  });

  it('tolerates a corrupted review log', async () => {
    const store = new Store(fakePersistence({ reviewLog: 'nonsense' }));
    await store.load();
    expect(store.reviewLog).toEqual([]);
  });

  it('creates state on demand and keeps it stable afterwards', async () => {
    const store = new Store(fakePersistence());
    await store.load();
    const first = store.ensureState('card-1', NOW);
    expect(store.ensureState('card-1', new Date('2027-01-01'))).toBe(first);
  });

  it('debounces writes and flush persists the latest data', async () => {
    vi.useFakeTimers();
    try {
      const persistence = fakePersistence();
      const store = new Store(persistence);
      await store.load();
      store.updateSettings({ dailyLimit: 7 });
      store.updateSettings({ dailyLimit: 9 });
      expect(persistence.saved).toHaveLength(0);
      await store.flush();
      expect(persistence.saved).toHaveLength(1);
      expect((persistence.saved[0] as { settings: { dailyLimit: number } }).settings.dailyLimit).toBe(9);
    } finally {
      vi.useRealTimers();
    }
  });

  it('records reviews and marks the day as reviewed once', async () => {
    const store = new Store(fakePersistence());
    await store.load();
    const entry: ReviewLogEntry = {
      cardId: 'c',
      at: NOW.toISOString(),
      grade: GRADE.GOOD,
      thinkMs: 4000,
      gradeMs: 2500,
      intervalDays: 3,
    };
    store.recordReview(entry, NOW);
    store.recordReview(entry, NOW);
    expect(store.reviewLog).toHaveLength(2);
    expect(store.reviewedDays).toHaveLength(1);
  });

  it('skips the log when logging is off but still tracks the day', async () => {
    const store = new Store(fakePersistence({ settings: { keepReviewLog: false } }));
    await store.load();
    store.recordReview(
      { cardId: 'c', at: NOW.toISOString(), grade: GRADE.GOOD, thinkMs: 1, gradeMs: 1, intervalDays: 1 },
      NOW
    );
    expect(store.reviewLog).toHaveLength(0);
    expect(store.reviewedDays).toHaveLength(1);
  });

  it('counts new cards per day', async () => {
    const store = new Store(fakePersistence());
    await store.load();
    expect(store.newCardsIntroducedToday(NOW)).toBe(0);
    store.countNewCardIntroduced(NOW);
    store.countNewCardIntroduced(NOW);
    expect(store.newCardsIntroducedToday(NOW)).toBe(2);
    expect(store.newCardsIntroducedToday(new Date('2026-08-14T08:00:00.000Z'))).toBe(0);
  });

  it('prunes states for cards that no longer exist', async () => {
    const store = new Store(fakePersistence());
    await store.load();
    store.ensureState('keep', NOW);
    store.ensureState('gone', NOW);
    expect(store.pruneOrphans(new Set(['keep']))).toBe(1);
    expect(Object.keys(store.states)).toEqual(['keep']);
  });
});

describe('computeStreak', () => {
  it('counts consecutive days ending today', () => {
    expect(computeStreak(['2026-08-11', '2026-08-12', '2026-08-13'], NOW)).toBe(3);
  });

  it('keeps the streak alive when today has not been reviewed yet', () => {
    expect(computeStreak(['2026-08-11', '2026-08-12'], NOW)).toBe(2);
  });

  it('breaks after a two-day gap and handles an empty history', () => {
    expect(computeStreak(['2026-08-10'], NOW)).toBe(0);
    expect(computeStreak([], NOW)).toBe(0);
  });
});

describe('computeStats', () => {
  it('separates new from reviewed cards and computes the mature ratio', () => {
    const states: Record<string, CardState> = {
      new: createState(NOW),
      young: { ...createState(NOW), reps: 2, intervalDays: 6, lastGrade: GRADE.GOOD },
      mature: {
        ...createState(NOW),
        reps: 6,
        intervalDays: 30,
        lastGrade: GRADE.EASY,
        dueAt: new Date('2026-09-10T08:00:00.000Z').toISOString(),
      },
    };
    const stats = computeStats(['new', 'young', 'mature'], states, [], ['2026-08-13'], NOW, 3);
    expect(stats.totalCards).toBe(3);
    expect(stats.newCards).toBe(1);
    expect(stats.dueToday).toBe(1); // young is due, mature is scheduled ahead
    expect(stats.matureRatio).toBe(0.5);
    expect(stats.streak).toBe(1);
  });

  it('summarises data quality from the recent log', () => {
    const log: ReviewLogEntry[] = [
      { cardId: 'a', at: NOW.toISOString(), grade: GRADE.EASY, thinkMs: 1000, gradeMs: 500, intervalDays: 6 },
      { cardId: 'b', at: NOW.toISOString(), grade: GRADE.AGAIN, thinkMs: 9000, gradeMs: 500, intervalDays: 1 },
    ];
    const stats = computeStats(['a'], {}, log, [], NOW, 3);
    expect(stats.reviewedToday).toBe(2);
    expect(stats.averageThinkMs).toBe(5000);
    expect(stats.fastRevealRatio).toBe(0.5);
    expect(stats.highGradeRatio).toBe(0.5);
  });
});
