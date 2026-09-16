import { describe, it, expect } from 'vitest';
import { generateListing } from '../src/listing/generate';

// These are the kinds of hardcoded claims the generator must NEVER emit
// unless they were present on the source canonical product record.
const FORBIDDEN_PLACEHOLDER_CLAIMS = [
  '1 year warranty',
  '2 year warranty',
  'lifetime warranty',
  '100% genuine',
  'certified organic',
  'ce certified',
  'money back guarantee',
  'authentic guaranteed',
];

describe('listing generator', () => {
  it('builds title/description/item-specifics only from provided fields', () => {
    const listing = generateListing({
      title: 'Dyson V15 Detect Cordless Vacuum',
      brand: 'Dyson',
      model: 'V15 Detect',
      gtin: '5025155050671',
      category: 'Home Appliances',
      description: 'Cordless vacuum with laser dust detection.',
      imageUrl: 'https://example.com/img.jpg',
    });
    expect(listing.itemSpecifics.Brand).toBe('Dyson');
    expect(listing.itemSpecifics.Model).toBe('V15 Detect');
    expect(listing.itemSpecifics.GTIN).toBe('5025155050671');
    expect(listing.description).toContain('laser dust detection');
  });

  it('omits missing fields rather than inventing them', () => {
    const listing = generateListing({ title: 'Mystery Gadget' });
    expect(listing.itemSpecifics.Brand).toBeUndefined();
    expect(listing.itemSpecifics.Model).toBeUndefined();
    expect(listing.itemSpecifics.GTIN).toBeUndefined();
    expect(listing.description).toContain('Not specified');
  });

  it('never emits hardcoded placeholder claims not present in source data', () => {
    const listing = generateListing({ title: 'Mystery Gadget' });
    const haystack = (listing.title + ' ' + listing.description).toLowerCase();
    for (const claim of FORBIDDEN_PLACEHOLDER_CLAIMS) {
      expect(haystack).not.toContain(claim);
    }
  });

  it('truncates overly long titles to the eBay limit', () => {
    const longTitle = 'A'.repeat(120);
    const listing = generateListing({ title: longTitle });
    expect(listing.title.length).toBeLessThanOrEqual(80);
  });
});
