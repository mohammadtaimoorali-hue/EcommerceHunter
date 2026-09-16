// Canonical product identity resolution.
// Strategy: match by GTIN/EAN/UPC/MPN when present (exact, high-confidence);
// else fall back to brand+model exact match; else fuzzy title similarity via
// the Dice (Sorensen-Dice) bigram coefficient, no ML library required.

export interface CandidateProduct {
  id: string;
  title: string;
  brand?: string | null;
  model?: string | null;
  gtin?: string | null;
}

export interface NewProductInput {
  title: string;
  brand?: string | null;
  model?: string | null;
  gtin?: string | null;
}

export interface MatchResult {
  match: CandidateProduct | null;
  confidence: number; // 0..1
  reason: string;
}

/** Sorensen-Dice coefficient over character bigrams. */
export function diceCoefficient(a: string, b: string): number {
  const norm = (s: string) => s.toLowerCase().trim().replace(/\s+/g, ' ');
  const s1 = norm(a);
  const s2 = norm(b);
  if (s1 === s2) return 1;
  if (s1.length < 2 || s2.length < 2) return s1 === s2 ? 1 : 0;

  const bigrams = (s: string): Map<string, number> => {
    const map = new Map<string, number>();
    for (let i = 0; i < s.length - 1; i++) {
      const bg = s.substring(i, i + 2);
      map.set(bg, (map.get(bg) ?? 0) + 1);
    }
    return map;
  };

  const b1 = bigrams(s1);
  const b2 = bigrams(s2);
  let intersection = 0;
  for (const [bg, count] of b1.entries()) {
    const otherCount = b2.get(bg) ?? 0;
    intersection += Math.min(count, otherCount);
  }
  const total = Array.from(b1.values()).reduce((a2, b2c) => a2 + b2c, 0) +
    Array.from(b2.values()).reduce((a2, b2c) => a2 + b2c, 0);
  return total === 0 ? 0 : (2 * intersection) / total;
}

const TITLE_SIMILARITY_THRESHOLD = 0.6;

export function findCanonicalMatch(
  candidate: NewProductInput,
  existing: CandidateProduct[],
): MatchResult {
  // 1. Exact GTIN match — highest confidence.
  if (candidate.gtin) {
    const gtinMatch = existing.find((p) => p.gtin && p.gtin === candidate.gtin);
    if (gtinMatch) {
      return { match: gtinMatch, confidence: 1, reason: 'Exact GTIN/EAN/UPC match' };
    }
  }

  // 2. Exact brand+model match.
  if (candidate.brand && candidate.model) {
    const bmMatch = existing.find(
      (p) =>
        p.brand?.toLowerCase() === candidate.brand!.toLowerCase() &&
        p.model?.toLowerCase() === candidate.model!.toLowerCase(),
    );
    if (bmMatch) {
      return { match: bmMatch, confidence: 0.95, reason: 'Exact brand+model match' };
    }
  }

  // 3. Fuzzy title similarity (Dice coefficient over bigrams), optionally
  //    boosted by matching brand.
  let best: { product: CandidateProduct; score: number } | null = null;
  for (const p of existing) {
    let score = diceCoefficient(candidate.title, p.title);
    if (candidate.brand && p.brand && candidate.brand.toLowerCase() === p.brand.toLowerCase()) {
      score = Math.min(1, score + 0.1);
    }
    if (!best || score > best.score) {
      best = { product: p, score };
    }
  }

  if (best && best.score >= TITLE_SIMILARITY_THRESHOLD) {
    return {
      match: best.product,
      confidence: Math.round(best.score * 100) / 100,
      reason: `Fuzzy title similarity match (Dice score ${best.score.toFixed(2)})`,
    };
  }

  return { match: null, confidence: 0, reason: 'No sufficiently similar canonical product found' };
}
