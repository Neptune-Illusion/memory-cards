import type { Card } from '../types';

export interface GeneratedCard {
  question: string;
  answer: string;
  note?: string;
  source?: string;
}

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
    if (longer.indexOf(c) !== -1) matches++;
  }
  return matches / longer.length;
}

/**
 * Deduplicate generated cards:
 * 1. Within generated set: exact normalized question+answer pair
 * 2. Against existing cards: similarity threshold on question
 */
export function deduplicateCards(
  generated: GeneratedCard[],
  existing: Card[],
  threshold = 0.7
): GeneratedCard[] {
  const result: GeneratedCard[] = [];
  const seenPairs = new Set<string>();

  for (const card of generated) {
    const normQ = card.question.toLowerCase().replace(/[^\w\u4e00-\u9fff]/g, '');
    const normA = card.answer.toLowerCase().replace(/[^\w\u4e00-\u9fff]/g, '');
    const pairKey = normQ + '|||' + normA;

    if (seenPairs.has(pairKey)) continue;

    const isDuplicate = existing.some(
      (e) => stringSimilarity(card.question, e.question) >= threshold
    );
    if (isDuplicate) continue;

    seenPairs.add(pairKey);
    result.push(card);
  }

  return result;
}

/**
 * Apply a hard card-count limit. Call AFTER deduplication so the user
 * sees the highest-quality cards. Extracted as a named helper for testability.
 */
export function applyMaxCards(cards: GeneratedCard[], maxCards: number): GeneratedCard[] {
  return cards.slice(0, Math.max(0, maxCards));
}
