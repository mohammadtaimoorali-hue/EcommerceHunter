import { describe, it, expect } from 'vitest';
import { calculateTargetPrice } from '../src/engines/pricing';
import { DEFAULT_FEE_SETTINGS } from '../src/engines/profitability';

describe('pricing engine', () => {
  const baseCostInputs = {
    retailPrice: 100,
    shippingCost: 10,
    ...DEFAULT_FEE_SETTINGS,
  };

  it('never prices below the configured minimum', () => {
    const result = calculateTargetPrice({
      costInputs: baseCostInputs,
      desiredMarginPercent: 25,
      competitorPrices: [50], // absurdly low competitor price
      priceMin: 130,
      priceMax: 400,
    });
    expect(result.targetPrice).toBeGreaterThanOrEqual(130);
  });

  it('never prices above the configured maximum', () => {
    const result = calculateTargetPrice({
      costInputs: baseCostInputs,
      desiredMarginPercent: 90, // unreasonable margin forces high price
      competitorPrices: [],
      priceMin: 50,
      priceMax: 200,
    });
    expect(result.targetPrice).toBeLessThanOrEqual(200);
  });

  it('undercuts competitor median when profitable to do so', () => {
    const result = calculateTargetPrice({
      costInputs: baseCostInputs,
      desiredMarginPercent: 10,
      competitorPrices: [300, 310, 320],
      priceMin: 50,
      priceMax: 400,
    });
    expect(result.targetPrice).toBeLessThan(310);
    expect(result.targetPrice).toBeGreaterThan(100);
  });
});
