// Risk engine: keyword/category-based screening producing a coarse
// SAFE_TO_LIST / REVIEW_REQUIRED / BLOCKED verdict with human-readable reasons.
//
// This is a STARTING POINT, not a compliance system: the keyword/category
// lists below are illustrative and must be curated by a human familiar with
// eBay AU policy and Australian consumer law before any AUTONOMOUS listing
// of matched categories. Nothing here should be treated as legal advice.

export type RiskStatus = 'SAFE_TO_LIST' | 'REVIEW_REQUIRED' | 'BLOCKED';

export interface RiskAssessmentInput {
  title: string;
  description?: string | null;
  category?: string | null;
  brand?: string | null;
}

export interface RiskAssessmentResult {
  status: RiskStatus;
  reasons: string[];
}

interface RiskRule {
  keywords: string[];
  status: RiskStatus;
  reason: string;
}

// Config-driven rule list — extend/curate this over time.
export const RISK_RULES: RiskRule[] = [
  {
    keywords: ['firearm', 'gun', 'rifle', 'pistol', 'ammunition', 'ammo', 'taser', 'stun gun', 'switchblade'],
    status: 'BLOCKED',
    reason: 'Weapons-related keyword detected',
  },
  {
    keywords: ['fentanyl', 'opioid', 'anabolic steroid'],
    status: 'BLOCKED',
    reason: 'Prohibited controlled substance keyword detected',
  },
  {
    keywords: ['replica', 'counterfeit', 'knockoff', 'aaa quality', 'inspired by'],
    status: 'BLOCKED',
    reason: 'Counterfeit-indicating keyword detected',
  },
  {
    keywords: ['asbestos', 'lithium battery bulk', 'flammable gas', 'hazmat', 'compressed gas cylinder'],
    status: 'BLOCKED',
    reason: 'Hazardous materials keyword detected',
  },
  {
    keywords: ['recalled', 'product recall', 'safety recall'],
    status: 'BLOCKED',
    reason: 'Product appears on/mentions a safety recall',
  },
  {
    keywords: ['supplement', 'weight loss pill', 'testosterone booster', 'fat burner'],
    status: 'REVIEW_REQUIRED',
    reason: 'Supplement/health category requires manual compliance review',
  },
  {
    keywords: ['cures', 'treats', 'clinically proven to heal', 'fda approved cure'],
    status: 'REVIEW_REQUIRED',
    reason: 'Unverified medical claim language detected',
  },
  {
    keywords: ['adult', 'xxx', 'sex toy', 'lingerie'],
    status: 'REVIEW_REQUIRED',
    reason: 'Adult category requires manual review',
  },
  {
    keywords: ['rolex', 'louis vuitton', 'gucci', 'chanel'],
    status: 'REVIEW_REQUIRED',
    reason: 'Brand commonly targeted by counterfeiters requires manual authenticity review',
  },
];

const HIGH_RISK_CATEGORIES = ['Weapons', 'Supplements', 'Adult', 'Hazmat'];

export function assessRisk(input: RiskAssessmentInput): RiskAssessmentResult {
  const haystack = [input.title, input.description ?? '', input.brand ?? '']
    .join(' ')
    .toLowerCase();

  const reasons: string[] = [];
  let status: RiskStatus = 'SAFE_TO_LIST';

  for (const rule of RISK_RULES) {
    const matched = rule.keywords.some((kw) => haystack.includes(kw.toLowerCase()));
    if (matched) {
      reasons.push(rule.reason);
      if (rule.status === 'BLOCKED') {
        status = 'BLOCKED';
      } else if (rule.status === 'REVIEW_REQUIRED' && status !== 'BLOCKED') {
        status = 'REVIEW_REQUIRED';
      }
    }
  }

  if (input.category && HIGH_RISK_CATEGORIES.includes(input.category) && status === 'SAFE_TO_LIST') {
    status = 'REVIEW_REQUIRED';
    reasons.push(`Category "${input.category}" is flagged as high-risk and requires manual review`);
  }

  if (reasons.length === 0) {
    reasons.push('No risk keywords or categories matched');
  }

  return { status, reasons };
}
