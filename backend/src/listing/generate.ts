// Listing generator: builds an eBay listing draft (title/description/item
// specifics) using ONLY fields present on the canonical product record.
// Never invent specs like warranty, materials, or certifications — if a field
// is absent it is omitted from item specifics, and the description marks it
// "Not specified" rather than fabricating a claim. This is enforced by
// backend/tests/listing-generate.test.ts.

export interface CanonicalProductForListing {
  title: string;
  brand?: string | null;
  model?: string | null;
  gtin?: string | null;
  category?: string | null;
  description?: string | null;
  imageUrl?: string | null;
}

export interface GeneratedListing {
  title: string;
  description: string;
  itemSpecifics: Record<string, string>;
}

const MAX_TITLE_LEN = 80; // eBay title limit

export function generateListing(product: CanonicalProductForListing): GeneratedListing {
  const itemSpecifics: Record<string, string> = {};
  if (product.brand) itemSpecifics['Brand'] = product.brand;
  if (product.model) itemSpecifics['Model'] = product.model;
  if (product.gtin) itemSpecifics['GTIN'] = product.gtin;
  if (product.category) itemSpecifics['Category'] = product.category;
  itemSpecifics['Condition'] = 'New';

  let title = product.title;
  if (product.brand && !title.toLowerCase().includes(product.brand.toLowerCase())) {
    title = `${product.brand} ${title}`;
  }
  if (title.length > MAX_TITLE_LEN) {
    title = title.slice(0, MAX_TITLE_LEN - 1).trimEnd() + '…';
  }

  const descriptionLines: string[] = [];
  descriptionLines.push(`<h2>${escapeHtml(product.title)}</h2>`);
  if (product.description) {
    descriptionLines.push(`<p>${escapeHtml(product.description)}</p>`);
  } else {
    descriptionLines.push('<p>Not specified</p>');
  }

  descriptionLines.push('<ul>');
  descriptionLines.push(`<li>Brand: ${escapeHtml(product.brand ?? 'Not specified')}</li>`);
  descriptionLines.push(`<li>Model: ${escapeHtml(product.model ?? 'Not specified')}</li>`);
  descriptionLines.push(`<li>Category: ${escapeHtml(product.category ?? 'Not specified')}</li>`);
  descriptionLines.push('</ul>');

  return {
    title,
    description: descriptionLines.join('\n'),
    itemSpecifics,
  };
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
