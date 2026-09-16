import { describe, it, expect } from 'vitest';
import { diceCoefficient, findCanonicalMatch } from '../src/engines/duplicates';

describe('duplicates engine', () => {
  it('computes dice coefficient of 1 for identical strings', () => {
    expect(diceCoefficient('Dyson V15 Detect', 'Dyson V15 Detect')).toBe(1);
  });

  it('computes a high dice coefficient for near-identical titles', () => {
    const score = diceCoefficient('Dyson V15 Detect Cordless Vacuum', 'Dyson V15 Detect Vacuum Cordless');
    expect(score).toBeGreaterThan(0.8);
  });

  it('matches by exact GTIN over fuzzy title', () => {
    const existing = [{ id: '1', title: 'Totally Different Title', gtin: '12345' }];
    const result = findCanonicalMatch({ title: 'Some Product', gtin: '12345' }, existing);
    expect(result.match?.id).toBe('1');
    expect(result.confidence).toBe(1);
  });

  it('matches by brand+model when no gtin present', () => {
    const existing = [{ id: '2', title: 'Old title', brand: 'Sony', model: 'WH-1000XM5' }];
    const result = findCanonicalMatch({ title: 'New title', brand: 'Sony', model: 'WH-1000XM5' }, existing);
    expect(result.match?.id).toBe('2');
  });

  it('returns no match for dissimilar products', () => {
    const existing = [{ id: '3', title: 'Nintendo Switch OLED Console' }];
    const result = findCanonicalMatch({ title: 'Weber Q1200 Portable Gas BBQ' }, existing);
    expect(result.match).toBeNull();
  });
});
