// One format exported alone, as zodFormats names it: './sku#skuSchema'.
import { z } from 'zod';

export const skuSchema = z.string().regex(/^SKU-[0-9]{4}$/, 'Invalid SKU');

// A format that rewrites the value, which generation refuses as
// withValidation does: './sku#trimmedSkuSchema'.
export const trimmedSkuSchema = z.string().trim().toUpperCase();

// Formats that rewrite the value though they stay string schemas, which
// generation refuses too: z.url() trims ' https://a.com ', z.coerce.string()
// takes 12345 as '12345'.
export const linkSchema = z.url();
export const coercedSkuSchema = z.coerce.string();
