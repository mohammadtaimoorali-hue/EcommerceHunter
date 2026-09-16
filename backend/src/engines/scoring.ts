// Weighted opportunity scoring engine.
//
// FORMULA:
//   overallScore = w_demand*demand + w_trend*trend + w_competition*competition
//                + w_stock*stock + w_risk*risk + w_shipping*shipping
// where each sub-score is normalized to [0, 100] and weights are read from
// `settings` (key "scoring_weights"), defaulting to DEFAULT_WEIGHTS below and
// summing to 1.0. Higher sub-scores always mean "more attractive":
//   - demand: proxy for expected sell-through (e.g. category demand signal)
//   - trend: momentum of demand over time (rising = higher score)
//   - competition: INVERTED number/intensity of competing listings (fewer
//     competitors / less price pressure = higher score)
//   - stock: source stock availability confidence (in stock, healthy qty = higher)
//   - risk: INVERTED risk engine output (SAFE_TO_LIST = 100, BLOCKED = 0)
//   - shipping: cheaper/faster shipping = higher score

export interface ScoringWeights {
  demand: number;
  trend: number;
  competition: number;
  stock: number;
  risk: number;
  shipping: number;
}

export const DEFAULT_WEIGHTS: ScoringWeights = {
  demand: 0.25,
  trend: 0.15,
  competition: 0.2,
  stock: 0.15,
  risk: 0.15,
  shipping: 0.1,
};

export interface ScoringInputs {
  demandScore: number;
  trendScore: number;
  competitionScore: number;
  stockScore: number;
  riskScore: number;
  shippingScore: number;
  weights?: ScoringWeights;
}

export interface ScoringResult {
  overallScore: number;
  breakdown: {
    demand: number;
    trend: number;
    competition: number;
    stock: number;
    risk: number;
    shipping: number;
    weights: ScoringWeights;
  };
}

function clamp(n: number): number {
  return Math.max(0, Math.min(100, n));
}

export function calculateOpportunityScore(inputs: ScoringInputs): ScoringResult {
  const weights = inputs.weights ?? DEFAULT_WEIGHTS;

  const demand = clamp(inputs.demandScore);
  const trend = clamp(inputs.trendScore);
  const competition = clamp(inputs.competitionScore);
  const stock = clamp(inputs.stockScore);
  const risk = clamp(inputs.riskScore);
  const shipping = clamp(inputs.shippingScore);

  const overallScore =
    demand * weights.demand +
    trend * weights.trend +
    competition * weights.competition +
    stock * weights.stock +
    risk * weights.risk +
    shipping * weights.shipping;

  return {
    overallScore: Math.round(overallScore * 100) / 100,
    breakdown: { demand, trend, competition, stock, risk, shipping, weights },
  };
}

/** Convenience: derive a stock sub-score [0,100] from raw quantity/inStock. */
export function stockScoreFromQuantity(inStock: boolean, quantity: number | null): number {
  if (!inStock || !quantity || quantity <= 0) return 0;
  if (quantity >= 50) return 100;
  return Math.round((quantity / 50) * 100);
}

/** Convenience: derive a competition sub-score [0,100] — fewer competitors is better. */
export function competitionScoreFromCount(competitorCount: number): number {
  if (competitorCount <= 0) return 100;
  if (competitorCount >= 20) return 0;
  return Math.round(100 - (competitorCount / 20) * 100);
}

/** Convenience: derive a risk sub-score [0,100] from the risk engine's status. */
export function riskScoreFromStatus(status: 'SAFE_TO_LIST' | 'REVIEW_REQUIRED' | 'BLOCKED'): number {
  switch (status) {
    case 'SAFE_TO_LIST':
      return 100;
    case 'REVIEW_REQUIRED':
      return 40;
    case 'BLOCKED':
      return 0;
  }
}
