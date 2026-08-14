import { GRADE, type CardState, type Grade, type MemoryCardsSettings } from './types';

/**
 * SM-2 derived scheduler (SPEC §4). Pure functions: given a state and a grade,
 * return the next state. No clock access except the `now` argument.
 */

export const MIN_EASE = 1.3;
export const MAX_EASE = 3.0;
export const INITIAL_EASE = 2.5;
/** Interval in days at which a card counts as "mature" (SPEC §5). */
export const MATURE_INTERVAL_DAYS = 21;

const DAY_MS = 24 * 60 * 60 * 1000;

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export function createState(now: Date): CardState {
  return {
    reps: 0,
    intervalDays: 0,
    easeFactor: INITIAL_EASE,
    dueAt: now.toISOString(),
    lastGrade: null,
    lapses: 0,
    createdAt: now.toISOString(),
    firstLearnedAt: null,
  };
}

export interface ReviewOptions {
  initialIntervals: number[];
  /** Anti-cheat: halve the next interval when the answer was revealed/graded suspiciously fast. */
  lowConfidence?: boolean;
}

/** Apply a grade to a card state and return the next state (never mutates the input). */
export function review(
  state: CardState,
  grade: Grade,
  now: Date,
  options: ReviewOptions
): CardState {
  const next: CardState = { ...state };
  const [first = 1, second = 3, third = 6] = options.initialIntervals;

  if (grade < GRADE.HARD) {
    // Forgotten: back to the start of the learning phase.
    next.reps = 0;
    next.intervalDays = 1;
    next.lapses = state.lapses + 1;
  } else {
    if (state.reps === 0) {
      next.intervalDays = first;
    } else if (state.reps === 1) {
      next.intervalDays = second;
    } else if (state.reps === 2) {
      next.intervalDays = third;
    } else {
      const base =
        grade === GRADE.HARD
          ? state.intervalDays * 1.2
          : grade === GRADE.EASY
            ? state.intervalDays * state.easeFactor * 1.3
            : state.intervalDays * state.easeFactor;
      next.intervalDays = Math.max(1, Math.round(base));
    }
    next.reps = state.reps + 1;
    if (state.firstLearnedAt === null) {
      next.firstLearnedAt = now.toISOString();
    }
  }

  // SM-2 ease update.
  const delta = 0.1 - (5 - grade) * (0.08 + (5 - grade) * 0.02);
  next.easeFactor = clamp(round2(state.easeFactor + delta), MIN_EASE, MAX_EASE);

  if (options.lowConfidence && next.intervalDays > 1) {
    next.intervalDays = Math.max(1, Math.round(next.intervalDays * 0.5));
  }

  next.lastGrade = grade;
  next.dueAt = new Date(now.getTime() + next.intervalDays * DAY_MS).toISOString();
  return next;
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

export function isDue(state: CardState, now: Date): boolean {
  return new Date(state.dueAt).getTime() <= now.getTime();
}

export function daysOverdue(state: CardState, now: Date): number {
  return Math.max(0, Math.floor((now.getTime() - new Date(state.dueAt).getTime()) / DAY_MS));
}

export function isMature(state: CardState): boolean {
  return state.intervalDays >= MATURE_INTERVAL_DAYS;
}

export interface QueueInput {
  id: string;
  state: CardState | undefined;
}

export interface QueueResult {
  /** Card ids in review order. */
  order: string[];
  dueCount: number;
  newCount: number;
}

/**
 * Build today's queue (SPEC §4.4/§4.5): due cards sorted by overdue days then by
 * lowest last grade, capped by `dailyLimit`; new cards capped by the remaining
 * `newPerDay` budget and mixed in every 5 review cards.
 */
export function buildQueue(
  cards: QueueInput[],
  now: Date,
  settings: Pick<MemoryCardsSettings, 'dailyLimit' | 'newPerDay'>,
  newIntroducedToday = 0
): QueueResult {
  const due: { id: string; overdue: number; lastGrade: number }[] = [];
  const fresh: string[] = [];

  for (const card of cards) {
    if (!card.state || (card.state.reps === 0 && card.state.lastGrade === null)) {
      fresh.push(card.id);
      continue;
    }
    if (isDue(card.state, now)) {
      due.push({
        id: card.id,
        overdue: daysOverdue(card.state, now),
        lastGrade: card.state.lastGrade ?? 5,
      });
    }
  }

  due.sort((a, b) => b.overdue - a.overdue || a.lastGrade - b.lastGrade || a.id.localeCompare(b.id));
  fresh.sort((a, b) => a.localeCompare(b));

  const dueLimit = settings.dailyLimit > 0 ? settings.dailyLimit : due.length;
  const newBudget =
    settings.newPerDay > 0 ? Math.max(0, settings.newPerDay - newIntroducedToday) : fresh.length;

  const dueQueue = due.slice(0, dueLimit).map((entry) => entry.id);
  const newQueue = fresh.slice(0, newBudget);

  // Interleave: one new card after every 5 review cards.
  const order: string[] = [];
  let newIndex = 0;
  dueQueue.forEach((id, index) => {
    order.push(id);
    if ((index + 1) % 5 === 0 && newIndex < newQueue.length) {
      order.push(newQueue[newIndex++]);
    }
  });
  while (newIndex < newQueue.length) {
    order.push(newQueue[newIndex++]);
  }

  return { order, dueCount: dueQueue.length, newCount: newQueue.length };
}
