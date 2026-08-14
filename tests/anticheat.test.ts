import { describe, expect, it } from 'vitest';
import { checkGradeDistribution, checkTiming, shouldNudgeBeforeReveal } from '../src/anticheat';
import { GRADE, type Grade, type ReviewLogEntry } from '../src/types';

const thresholds = { minThinkSeconds: 3, minGradeSeconds: 2 };

describe('checkTiming', () => {
  it('flags a fast reveal followed by a high grade as low confidence', () => {
    const verdict = checkTiming({ thinkMs: 800, gradeMs: 5000, ...thresholds }, GRADE.EASY);
    expect(verdict.revealedTooFast).toBe(true);
    expect(verdict.lowConfidence).toBe(true);
    expect(verdict.message).toContain('缩短');
  });

  it('does not punish a fast reveal followed by Again', () => {
    const verdict = checkTiming({ thinkMs: 500, gradeMs: 4000, ...thresholds }, GRADE.AGAIN);
    expect(verdict.revealedTooFast).toBe(true);
    expect(verdict.lowConfidence).toBe(false);
  });

  it('mentions fast grading without halving the interval', () => {
    const verdict = checkTiming({ thinkMs: 9000, gradeMs: 400, ...thresholds }, GRADE.GOOD);
    expect(verdict.gradedTooFast).toBe(true);
    expect(verdict.lowConfidence).toBe(false);
    expect(verdict.message).toBeDefined();
  });

  it('stays silent on honest timing', () => {
    const verdict = checkTiming({ thinkMs: 6000, gradeMs: 3000, ...thresholds }, GRADE.GOOD);
    expect(verdict.lowConfidence).toBe(false);
    expect(verdict.message).toBeUndefined();
  });

  it('disables checks when thresholds are 0', () => {
    const verdict = checkTiming(
      { thinkMs: 10, gradeMs: 10, minThinkSeconds: 0, minGradeSeconds: 0 },
      GRADE.EASY
    );
    expect(verdict.revealedTooFast).toBe(false);
    expect(verdict.gradedTooFast).toBe(false);
    expect(verdict.lowConfidence).toBe(false);
  });
});

describe('shouldNudgeBeforeReveal', () => {
  it('nudges below the threshold and not above it', () => {
    expect(shouldNudgeBeforeReveal(1200, 3)).toBe(true);
    expect(shouldNudgeBeforeReveal(4000, 3)).toBe(false);
    expect(shouldNudgeBeforeReveal(10, 0)).toBe(false);
  });
});

function entry(grade: Grade, thinkMs: number): ReviewLogEntry {
  return { cardId: 'c', at: '2026-08-13T00:00:00.000Z', grade, thinkMs, gradeMs: 3000, intervalDays: 6 };
}

describe('checkGradeDistribution', () => {
  it('flags mostly-high grades with mostly-fast reveals', () => {
    const log = Array.from({ length: 20 }, () => entry(GRADE.EASY, 900));
    const verdict = checkGradeDistribution(log, 3);
    expect(verdict.suspicious).toBe(true);
    expect(verdict.highGradeRatio).toBe(1);
    expect(verdict.message).toBeDefined();
  });

  it('accepts high grades when the user actually thought', () => {
    const log = Array.from({ length: 20 }, () => entry(GRADE.EASY, 8000));
    expect(checkGradeDistribution(log, 3).suspicious).toBe(false);
  });

  it('accepts fast reveals when grades are honest', () => {
    const log = Array.from({ length: 20 }, (_, i) =>
      entry(i % 2 === 0 ? GRADE.AGAIN : GRADE.HARD, 900)
    );
    expect(checkGradeDistribution(log, 3).suspicious).toBe(false);
  });

  it('needs a minimum sample before judging', () => {
    const log = Array.from({ length: 5 }, () => entry(GRADE.EASY, 200));
    expect(checkGradeDistribution(log, 3).suspicious).toBe(false);
  });

  it('only looks at the rolling window', () => {
    const log = [
      ...Array.from({ length: 40 }, () => entry(GRADE.AGAIN, 9000)),
      ...Array.from({ length: 20 }, () => entry(GRADE.EASY, 500)),
    ];
    expect(checkGradeDistribution(log, 3, 20).suspicious).toBe(true);
  });
});
