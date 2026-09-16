// Landed cost / profitability calculator.
//
// ASSUMPTION (as of this writing, cite in README too — fees change over time):
// eBay AU final value fee ~13% of the total sale amount (item + shipping) for
// most categories under eBay's managed payments, plus a per-order payment
// processing component modeled here as ~2.9% + $0.30 AUD (eBay's managed
// payments processing is typically bundled into the FVF, but we model it as
// a separate configurable line so tenants can tune it against their real
// category/fee schedule without touching code).

export interface ProfitabilityInputs {
  retailPrice: number;
  shippingCost: number;
  sellPrice: number;
  /** e.g. 0.13 for 13% */
  ebayFvfRate: number;
  /** e.g. 0.029 for 2.9% */
  paymentProcessingRate: number;
  /** flat fee per transaction, e.g. 0.30 */
  paymentProcessingFlatFee: number;
  /** e.g. 0.05 for 5% overhead on cost of goods */
  businessOverheadRate: number;
}

export interface ProfitabilityResult {
  totalCost: number;
  ebayFee: number;
  paymentFee: number;
  overheadCost: number;
  profit: number;
  marginPercent: number;
}

export function calculateProfitability(inputs: ProfitabilityInputs): ProfitabilityResult {
  const {
    retailPrice,
    shippingCost,
    sellPrice,
    ebayFvfRate,
    paymentProcessingRate,
    paymentProcessingFlatFee,
    businessOverheadRate,
  } = inputs;

  const ebayFee = sellPrice * ebayFvfRate;
  const paymentFee = sellPrice * paymentProcessingRate + paymentProcessingFlatFee;
  const overheadCost = retailPrice * businessOverheadRate;

  const totalCost = retailPrice + shippingCost + ebayFee + paymentFee + overheadCost;
  const profit = sellPrice - totalCost;
  const marginPercent = sellPrice > 0 ? (profit / sellPrice) * 100 : 0;

  return {
    totalCost: round2(totalCost),
    ebayFee: round2(ebayFee),
    paymentFee: round2(paymentFee),
    overheadCost: round2(overheadCost),
    profit: round2(profit),
    marginPercent: round2(marginPercent),
  };
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

export const DEFAULT_FEE_SETTINGS = {
  ebayFvfRate: 0.13,
  paymentProcessingRate: 0.029,
  paymentProcessingFlatFee: 0.3,
  businessOverheadRate: 0.05,
};
