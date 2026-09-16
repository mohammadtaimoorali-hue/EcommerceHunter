import { describe, it, expect } from 'vitest';
import { assessRisk } from '../src/engines/risk';

describe('risk engine', () => {
  it('flags weapons keywords as BLOCKED', () => {
    const result = assessRisk({ title: 'Tactical Pistol Holster' });
    expect(result.status).toBe('BLOCKED');
    expect(result.reasons.length).toBeGreaterThan(0);
  });

  it('flags supplements as REVIEW_REQUIRED', () => {
    const result = assessRisk({ title: 'Fat Burner Weight Loss Supplement' });
    expect(result.status).toBe('REVIEW_REQUIRED');
  });

  it('returns SAFE_TO_LIST for an ordinary product', () => {
    const result = assessRisk({ title: 'Stainless Steel Kettle 1.7L', category: 'Kitchen Appliances' });
    expect(result.status).toBe('SAFE_TO_LIST');
  });

  it('flags high-risk category even without keyword match', () => {
    const result = assessRisk({ title: 'Assorted item', category: 'Weapons' });
    expect(result.status).toBe('REVIEW_REQUIRED');
  });
});
