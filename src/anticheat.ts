import { GRADE, type Grade, type ReviewLogEntry } from './types';

/**
 * Anti familiarity-bias checks (SPEC §8). Pure functions.
 *
 * Familiarity bias: the question merely *looks* familiar, the user reveals without
 * actually recalling and grades high. That inflates the schedule and hurts retention.
 * All messages are encouraging, never accusatory (SPEC §8.4).
 */

export interface TimingCheck {
  thinkMs: number;
  gradeMs: number;
  minThinkSeconds: number;
  minGradeSeconds: number;
}

export interface TimingVerdict {
  revealedTooFast: boolean;
  gradedTooFast: boolean;
  /** True when the resulting interval should be halved. */
  lowConfidence: boolean;
  message?: string;
}

export function checkTiming(input: TimingCheck, grade: Grade): TimingVerdict {
  const revealedTooFast =
    input.minThinkSeconds > 0 && input.thinkMs < input.minThinkSeconds * 1000;
  const gradedTooFast = input.minGradeSeconds > 0 && input.gradeMs < input.minGradeSeconds * 1000;
  const highGrade = grade >= GRADE.GOOD;
  const lowConfidence = revealedTooFast && highGrade;

  let message: string | undefined;
  if (lowConfidence) {
    message = '为了帮你记得更牢，这张卡的间隔缩短了一半 — 下次先在脑海里答一遍再揭晓。';
  } else if (gradedTooFast) {
    message = '评分很快，确认是按真实回忆程度评的吗？';
  }

  return { revealedTooFast, gradedTooFast, lowConfidence, message };
}

/** Should we nudge before revealing? */
export function shouldNudgeBeforeReveal(thinkMs: number, minThinkSeconds: number): boolean {
  return minThinkSeconds > 0 && thinkMs < minThinkSeconds * 1000;
}

export interface GradeDistributionVerdict {
  /** Fraction of Good+Easy grades in the window. */
  highGradeRatio: number;
  /** Fraction of reveals below the think threshold. */
  fastRevealRatio: number;
  suspicious: boolean;
  message?: string;
}

/**
 * Rolling-window grade distribution check: >85% Good/Easy combined with mostly
 * sub-threshold think time reads as grinding through cards rather than recalling.
 */
export function checkGradeDistribution(
  log: ReviewLogEntry[],
  minThinkSeconds: number,
  windowSize = 20
): GradeDistributionVerdict {
  const window = log.slice(-windowSize);
  if (window.length < Math.min(10, windowSize)) {
    return { highGradeRatio: 0, fastRevealRatio: 0, suspicious: false };
  }
  const high = window.filter((entry) => entry.grade >= GRADE.GOOD).length / window.length;
  const threshold = minThinkSeconds > 0 ? minThinkSeconds * 1000 : 3000;
  const fast = window.filter((entry) => entry.thinkMs < threshold).length / window.length;
  const suspicious = high > 0.85 && fast > 0.5;
  return {
    highGradeRatio: high,
    fastRevealRatio: fast,
    suspicious,
    message: suspicious
      ? '看起来评分偏高而思考时间偏短。按真实回忆程度评分，复习安排才会真的帮到你。'
      : undefined,
  };
}
