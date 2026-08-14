import { isMature } from './scheduler';
import { GRADE, type CardState, type ReviewLogEntry } from './types';

/** Dashboard metrics (SPEC §5). Pure functions. */

export interface Stats {
  totalCards: number;
  dueToday: number;
  reviewedToday: number;
  newCards: number;
  matureRatio: number;
  streak: number;
  averageEase: number;
  averageThinkMs: number;
  fastRevealRatio: number;
  highGradeRatio: number;
}

export function toDayKey(date: Date): string {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, '0');
  const day = `${date.getDate()}`.padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Consecutive days ending today (or yesterday, so an unfinished today does not
 * break a streak) on which at least one card was reviewed.
 */
export function computeStreak(reviewedDays: string[], now: Date): number {
  const days = new Set(reviewedDays);
  if (days.size === 0) return 0;

  const cursor = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  if (!days.has(toDayKey(cursor))) {
    cursor.setDate(cursor.getDate() - 1);
    if (!days.has(toDayKey(cursor))) return 0;
  }

  let streak = 0;
  while (days.has(toDayKey(cursor))) {
    streak += 1;
    cursor.setDate(cursor.getDate() - 1);
  }
  return streak;
}

export function computeStats(
  cardIds: string[],
  states: Record<string, CardState>,
  log: ReviewLogEntry[],
  reviewedDays: string[],
  now: Date,
  minThinkSeconds: number
): Stats {
  const known = cardIds.map((id) => states[id]).filter((state): state is CardState => Boolean(state));
  const reviewed = known.filter((state) => state.lastGrade !== null);
  const todayKey = toDayKey(now);

  const dueToday = reviewed.filter((state) => new Date(state.dueAt).getTime() <= now.getTime()).length;
  const reviewedToday = log.filter((entry) => toDayKey(new Date(entry.at)) === todayKey).length;
  const mature = reviewed.filter(isMature).length;
  const threshold = minThinkSeconds > 0 ? minThinkSeconds * 1000 : 3000;

  const recent = log.slice(-50);
  const averageThinkMs =
    recent.length > 0 ? Math.round(recent.reduce((sum, e) => sum + e.thinkMs, 0) / recent.length) : 0;
  const fastRevealRatio =
    recent.length > 0 ? recent.filter((e) => e.thinkMs < threshold).length / recent.length : 0;
  const highGradeRatio =
    recent.length > 0 ? recent.filter((e) => e.grade >= GRADE.GOOD).length / recent.length : 0;

  return {
    totalCards: cardIds.length,
    dueToday,
    reviewedToday,
    newCards: cardIds.length - reviewed.length,
    matureRatio: reviewed.length > 0 ? mature / reviewed.length : 0,
    streak: computeStreak(reviewedDays, now),
    averageEase:
      reviewed.length > 0
        ? Math.round((reviewed.reduce((sum, s) => sum + s.easeFactor, 0) / reviewed.length) * 100) / 100
        : 0,
    averageThinkMs,
    fastRevealRatio,
    highGradeRatio,
  };
}
