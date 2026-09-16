// Target price engine: chooses a sell price given cost, desired margin, and
// competitor signals, always respecting explicit min/max bounds and never
// pricing below the min bound (even if that means the desired margin isn't hit).
import { calculateProfitability, ProfitabilityInputs } from './profitability';

export interface PricingInputs {
  costInputs: Omit<ProfitabilityInputs, 'sellPrice'>;
  desiredMarginPercent: number;
  competitorPrices: number[];
  priceMin: number;
  priceMax: number;
}

export interface PricingResult {
  targetPrice: number;
  priceMin: number;
  priceMax: number;
  rationale: string;
}

/**
 * Solve for the sell price that achieves `desiredMarginPercent`, given that
 * fees are proportional to sell price. Derived algebraically from
 * profit = sellPrice - (retail + shipping + overhead) - sellPrice*(fvf+payRate) - flatFee
 * margin = profit / sellPrice
 * =>  sellPrice = (fixedCosts + flatFee) / (1 - fvf - payRate - marginFraction)
 */
function solveForMargin(inputs: PricingInputs['costInputs'], marginFraction: number): number {
  const fixedCosts =
    inputs.retailPrice + inputs.shippingCost + inputs.retailPrice * inputs.businessOverheadRate;
  const denominator =
    1 - inputs.ebayFvfRate - inputs.paymentProcessingRate - marginFraction;
  if (denominator <= 0) {
    // Margin target infeasible given fee structure; fall back to a large price.
    return fixedCosts * 10;
  }
  return (fixedCosts + inputs.paymentProcessingFlatFee) / denominator;
}

export function calculateTargetPrice(inputs: PricingInputs): PricingResult {
  const { costInputs, desiredMarginPercent, competitorPrices, priceMin, priceMax } = inputs;

  const marginBasedPrice = solveForMargin(costInputs, desiredMarginPercent / 100);

  let targetPrice = marginBasedPrice;
  let rationale = `Priced to hit ${desiredMarginPercent}% margin target.`;

  if (competitorPrices.length > 0) {
    const sorted = [...competitorPrices].sort((a, b) => a - b);
    const median = sorted[Math.floor(sorted.length / 2)];
    // Undercut the median competitor slightly, but never go below the
    // margin-based price floor derived above unless that would exceed max.
    const competitivePrice = median * 0.98;
    if (competitivePrice > marginBasedPrice) {
      targetPrice = competitivePrice;
      rationale = `Priced just under median competitor price ($${median.toFixed(2)}) while still clearing the margin floor.`;
    } else {
      rationale = `Competitor median ($${median.toFixed(2)}) is below our margin floor; holding margin-based price.`;
    }
  }

  // Clamp to bounds — never below min.
  if (targetPrice < priceMin) {
    targetPrice = priceMin;
    rationale += ' Clamped up to configured price floor.';
  }
  if (targetPrice > priceMax) {
    targetPrice = priceMax;
    rationale += ' Clamped down to configured price ceiling.';
  }

  const profitCheck = calculateProfitability({ ...costInputs, sellPrice: targetPrice });

  return {
    targetPrice: round2(targetPrice),
    priceMin: round2(priceMin),
    priceMax: round2(priceMax),
    rationale: `${rationale} Estimated margin at target price: ${profitCheck.marginPercent}%.`,
  };
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
