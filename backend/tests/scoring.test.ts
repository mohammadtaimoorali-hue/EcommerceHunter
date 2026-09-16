import { describe, it, expect } from 'vitest';
import {
  calculateOpportunityScore,
  DEFAULT_WEIGHTS,
  stockScoreFromQuantity,
  competitionScoreFromCount,
  riskScoreFromStatus,
} from '../src/engines/scoring';

describe('scoring engine', () => {
  it('weights sub-scores according to DEFAULT_WEIGHTS and sums correctly', () => {
    const result = calculateOpportunityScore({
      demandScore: 100,
      trendScore: 100,
      competitionScore: 100,
      stockScore: 100,
      riskScore: 100,
      shippingScore: 100,
    });
    expect(result.overallScore).toBeCloseTo(100, 5);
  });

  it('clamps out-of-range sub-scores into [0,100]', () => {
    const result = calculateOpportunityScore({
      demandScore: 150,
      trendScore: -20,
      competitionScore: 50,
      stockScore: 50,
      riskScore: 50,
      shippingScore: 50,
    });
    expect(result.breakdown.demand).toBe(100);
    expect(result.breakdown.trend).toBe(0);
  });

  it('respects custom weights', () => {
    const weights = { demand: 1, trend: 0, competition: 0, stock: 0, risk: 0, shipping: 0 };
    const result = calculateOpportunityScore({
      demandScore: 80,
      trendScore: 0,
      competitionScore: 0,
      stockScore: 0,
      riskScore: 0,
      shippingScore: 0,
      weights,
    });
    expect(result.overallScore).toBe(80);
  });

  it('derives stock score from quantity', () => {
    expect(stockScoreFromQuantity(false, 0)).toBe(0);
    expect(stockScoreFromQuantity(true, 25)).toBe(50);
    expect(stockScoreFromQuantity(true, 100)).toBe(100);
  });

  it('derives competition score inversely from competitor count', () => {
    expect(competitionScoreFromCount(0)).toBe(100);
    expect(competitionScoreFromCount(20)).toBe(0);
  });

  it('derives risk score from status', () => {
    expect(riskScoreFromStatus('SAFE_TO_LIST')).toBe(100);
    expect(riskScoreFromStatus('BLOCKED')).toBe(0);
  });
});
