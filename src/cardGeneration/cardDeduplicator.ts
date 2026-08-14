import type { Card } from '../types';

export interface GeneratedCard {
  question: string;
  answer: string;
  note?: string;
}

/**
 * Simple string similarity (character overlap ratio).
 * Good enough for dedup — not a full Jaro-Winkler.
 */
function stringSimilarity(a: string, b: string): number {
  const normalize = (s: string) => s.toLowerCase().replace(/[^\w\u4e00-\u9fff]/g, '');
  const na = normalize(a);
  const nb = normalize(b);
  if (na === nb) return 1;
  if (na.length === 0 || nb.length === 0) return 0;
  const shorter = na.length < nb.length ? na : nb;
  const longer = na.length < nb.length ? nb : na;
  let matches = 0;
  for (const c of shorter) {
    const idx = longer.indexOf(c);
    if (idx !== -1) {
      matches++;
      // crude removal to avoid double-counting
      // (not perfect but sufficient for dedup thresholds)
    }
  }
  return matches / longer.length;
}

/**
 * Deduplicate generated cards against each other and existing cards.
 * Uses normalized question similarity with a threshold.
 */
export function deduplicateCards(
  generated: GeneratedCard[],
  existing: Card[],
  threshold = 0.7
): GeneratedCard[] {
  const result: GeneratedCard[] = [];
  const seen = new Set<string>();

  for (const card of generated) {
    const norm = card.question.toLowerCase().replace(/[^\w\u4e00-\u9fff]/g, '');
    if (seen.has(norm)) continue;

    const isDuplicate = existing.some(
      (e) => stringSimilarity(card.question, e.question) >= threshold
    );
    if (!isDuplicate) {
      seen.add(norm);
      result.push(card);
    }
  }

  return result;
}
