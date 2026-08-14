/** Core data types shared across parser, scheduler and UI. */

/** A card parsed out of a note. Content is derived from the note (source of truth). */
export interface Card {
  /** Stable id: `notePath::index` or `notePath::frontmatterId`. */
  id: string;
  notePath: string;
  question: string;
  answer: string;
  /** Optional "why I got it wrong / how to remember" block. */
  note?: string;
  tags: string[];
  /** Line number in the note where the card starts (1-based), for "open source note". */
  line: number;
}

/** Review grades, mapped onto SM-2 values (see SPEC §3.1). */
export const GRADE = {
  AGAIN: 2,
  HARD: 3,
  GOOD: 4,
  EASY: 5,
} as const;

export type Grade = (typeof GRADE)[keyof typeof GRADE];

/** Persisted scheduling state for one card. */
export interface CardState {
  reps: number;
  intervalDays: number;
  easeFactor: number;
  /** ISO timestamp. */
  dueAt: string;
  lastGrade: Grade | null;
  lapses: number;
  createdAt: string;
  firstLearnedAt: string | null;
}

export interface ReviewLogEntry {
  cardId: string;
  at: string;
  grade: Grade;
  /** ms between showing the question and revealing the answer. */
  thinkMs: number;
  /** ms between revealing the answer and grading. */
  gradeMs: number;
  flag?: 'too_fast';
  intervalDays: number;
}

export interface MemoryCardsSettings {
  cardFolder: string;
  newPerDay: number;
  dailyLimit: number;
  /** Minimum think time before revealing, in seconds. 0 disables the nudge. */
  minThinkSeconds: number;
  /** Minimum time between reveal and grading, in seconds. 0 disables. */
  minGradeSeconds: number;
  /** Learning-phase intervals in days. */
  initialIntervals: number[];
  /** Only review cards carrying one of these tags. Empty = all cards. */
  tagFilter: string[];
  questionSeparator: string;
  noteSeparator: string;
  keepReviewLog: boolean;
}

export const DEFAULT_SETTINGS: MemoryCardsSettings = {
  cardFolder: '卡片',
  newPerDay: 10,
  dailyLimit: 20,
  minThinkSeconds: 3,
  minGradeSeconds: 2,
  initialIntervals: [1, 3, 6],
  tagFilter: [],
  questionSeparator: '???',
  noteSeparator: ':::',
  keepReviewLog: true,
};

/** Shape of data.json. */
export interface PluginData {
  settings: MemoryCardsSettings;
  states: Record<string, CardState>;
  reviewLog: ReviewLogEntry[];
  /** ISO dates (YYYY-MM-DD) on which at least one card was reviewed. */
  reviewedDays: string[];
  /** Per-day counter for new-card introduction: { 'YYYY-MM-DD': count }. */
  newCardsIntroduced: Record<string, number>;
  /** Active session (if review was interrupted). Restored on next startReview(). */
  activeSession?: {
    queueIds: string[];
    currentIndex: number;
    revealed: boolean;
    startedAt: string;
  };
}
