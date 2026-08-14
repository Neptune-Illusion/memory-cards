import { describe, expect, it } from 'vitest';
import {
  buildQueue,
  createState,
  INITIAL_EASE,
  isMature,
  MIN_EASE,
  review,
} from '../src/scheduler';
import { GRADE, type CardState, type Grade } from '../src/types';

const NOW = new Date('2026-08-13T08:00:00.000Z');
const options = { initialIntervals: [1, 3, 6] };

function sequence(grades: Grade[], now = NOW): CardState {
  let state = createState(now);
  let clock = now;
  for (const grade of grades) {
    state = review(state, grade, clock, options);
    clock = new Date(state.dueAt);
  }
  return state;
}

describe('review', () => {
  it('walks the learning phase 1 → 3 → 6 days', () => {
    expect(sequence([GRADE.GOOD]).intervalDays).toBe(1);
    expect(sequence([GRADE.GOOD, GRADE.GOOD]).intervalDays).toBe(3);
    expect(sequence([GRADE.GOOD, GRADE.GOOD, GRADE.GOOD]).intervalDays).toBe(6);
  });

  it('multiplies by ease once out of the learning phase', () => {
    const state = sequence([GRADE.GOOD, GRADE.GOOD, GRADE.GOOD, GRADE.GOOD]);
    // 6 days * ease (2.5 after four Good grades) = 15
    expect(state.intervalDays).toBe(15);
    expect(state.reps).toBe(4);
  });

  it('gives Easy a 1.3 bonus over Good', () => {
    const good = sequence([GRADE.GOOD, GRADE.GOOD, GRADE.GOOD, GRADE.GOOD]);
    const easy = sequence([GRADE.GOOD, GRADE.GOOD, GRADE.GOOD, GRADE.EASY]);
    expect(easy.intervalDays).toBeGreaterThan(good.intervalDays);
  });

  it('grows Hard slowly and lowers ease', () => {
    const state = sequence([GRADE.GOOD, GRADE.GOOD, GRADE.GOOD, GRADE.HARD]);
    expect(state.intervalDays).toBe(7); // 6 * 1.2
    expect(state.easeFactor).toBeLessThan(INITIAL_EASE);
  });

  it('resets to 1 day and counts a lapse on Again', () => {
    const mature = sequence([GRADE.GOOD, GRADE.GOOD, GRADE.GOOD, GRADE.GOOD]);
    const lapsed = review(mature, GRADE.AGAIN, NOW, options);
    expect(lapsed.intervalDays).toBe(1);
    expect(lapsed.reps).toBe(0);
    expect(lapsed.lapses).toBe(1);
    expect(lapsed.dueAt).toBe(new Date(NOW.getTime() + 86400000).toISOString());
  });

  it('clamps ease at the floor after repeated failures', () => {
    const state = sequence(Array.from({ length: 12 }, () => GRADE.AGAIN));
    expect(state.easeFactor).toBe(MIN_EASE);
  });

  it('never mutates the input state', () => {
    const state = createState(NOW);
    const snapshot = { ...state };
    review(state, GRADE.EASY, NOW, options);
    expect(state).toEqual(snapshot);
  });

  it('records firstLearnedAt only once', () => {
    const first = review(createState(NOW), GRADE.GOOD, NOW, options);
    const later = new Date('2026-08-20T08:00:00.000Z');
    const second = review(first, GRADE.GOOD, later, options);
    expect(second.firstLearnedAt).toBe(first.firstLearnedAt);
  });

  it('halves the interval when confidence is low (anti-cheat correction)', () => {
    const base = sequence([GRADE.GOOD, GRADE.GOOD, GRADE.GOOD]);
    const honest = review(base, GRADE.GOOD, NOW, options);
    const suspicious = review(base, GRADE.GOOD, NOW, { ...options, lowConfidence: true });
    expect(suspicious.intervalDays).toBe(Math.round(honest.intervalDays * 0.5));
  });

  it('marks cards mature at 21 days', () => {
    expect(isMature({ ...createState(NOW), intervalDays: 21 })).toBe(true);
    expect(isMature({ ...createState(NOW), intervalDays: 20 })).toBe(false);
  });
});

describe('buildQueue', () => {
  const settings = { dailyLimit: 20, newPerDay: 10 };

  function dueState(overdueDays: number, lastGrade: Grade = GRADE.GOOD): CardState {
    return {
      ...createState(NOW),
      reps: 3,
      intervalDays: 6,
      lastGrade,
      dueAt: new Date(NOW.getTime() - overdueDays * 86400000).toISOString(),
    };
  }

  it('sorts due cards by overdue days, then by lowest last grade', () => {
    const result = buildQueue(
      [
        { id: 'a', state: dueState(1, GRADE.EASY) },
        { id: 'b', state: dueState(5, GRADE.GOOD) },
        { id: 'c', state: dueState(5, GRADE.HARD) },
      ],
      NOW,
      settings
    );
    expect(result.order).toEqual(['c', 'b', 'a']);
    expect(result.dueCount).toBe(3);
  });

  it('excludes cards that are not yet due', () => {
    const future = { ...dueState(0), dueAt: new Date(NOW.getTime() + 86400000).toISOString() };
    const result = buildQueue([{ id: 'later', state: future }], NOW, settings);
    expect(result.order).toEqual([]);
  });

  it('treats missing or untouched state as a new card', () => {
    const result = buildQueue(
      [
        { id: 'no-state', state: undefined },
        { id: 'fresh', state: createState(NOW) },
      ],
      NOW,
      settings
    );
    expect(result.newCount).toBe(2);
    expect(result.order).toEqual(['fresh', 'no-state']);
  });

  it('respects the daily review limit', () => {
    const cards = Array.from({ length: 30 }, (_, i) => ({
      id: `card-${`${i}`.padStart(2, '0')}`,
      state: dueState(1),
    }));
    const result = buildQueue(cards, NOW, { dailyLimit: 5, newPerDay: 0 });
    expect(result.order).toHaveLength(5);
  });

  it('subtracts new cards already introduced today', () => {
    const cards = Array.from({ length: 10 }, (_, i) => ({ id: `n${i}`, state: undefined }));
    const result = buildQueue(cards, NOW, { dailyLimit: 20, newPerDay: 4 }, 3);
    expect(result.newCount).toBe(1);
  });

  it('interleaves one new card after every five review cards', () => {
    const due = Array.from({ length: 10 }, (_, i) => ({ id: `d${i}`, state: dueState(1) }));
    const fresh = [{ id: 'n0', state: undefined }, { id: 'n1', state: undefined }];
    const result = buildQueue([...due, ...fresh], NOW, settings);
    expect(result.order[5]).toBe('n0');
    expect(result.order[11]).toBe('n1');
    expect(result.order).toHaveLength(12);
  });

  it('treats limits of 0 as unlimited reviews / all new cards', () => {
    const cards = Array.from({ length: 25 }, (_, i) => ({ id: `d${i}`, state: dueState(1) }));
    const result = buildQueue(cards, NOW, { dailyLimit: 0, newPerDay: 0 });
    expect(result.dueCount).toBe(25);
  });
});
