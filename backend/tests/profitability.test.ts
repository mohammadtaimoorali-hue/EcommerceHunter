import { describe, it, expect } from 'vitest';
import { calculateProfitability, DEFAULT_FEE_SETTINGS } from '../src/engines/profitability';

describe('profitability engine', () => {
  it('computes profit and margin correctly for a simple case', () => {
    const result = calculateProfitability({
      retailPrice: 100,
      shippingCost: 10,
      sellPrice: 200,
      ...DEFAULT_FEE_SETTINGS,
    });
    // ebayFee = 200*0.13 = 26; paymentFee = 200*0.029+0.30 = 6.1; overhead = 100*0.05=5
    // totalCost = 100+10+26+6.1+5 = 147.1; profit = 200-147.1=52.9
    expect(result.ebayFee).toBeCloseTo(26, 2);
    expect(result.paymentFee).toBeCloseTo(6.1, 2);
    expect(result.overheadCost).toBeCloseTo(5, 2);
    expect(result.totalCost).toBeCloseTo(147.1, 2);
    expect(result.profit).toBeCloseTo(52.9, 2);
    expect(result.marginPercent).toBeCloseTo((52.9 / 200) * 100, 1);
  });

  it('produces negative profit when sell price is too low', () => {
    const result = calculateProfitability({
      retailPrice: 100,
      shippingCost: 10,
      sellPrice: 50,
      ...DEFAULT_FEE_SETTINGS,
    });
    expect(result.profit).toBeLessThan(0);
  });
});
