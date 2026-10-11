// One format exported alone, as zodFormats names it: './sku#skuSchema'.
import { z } from 'zod';

export const skuSchema = z.string().regex(/^SKU-[0-9]{4}$/, 'Invalid SKU');

// A format that rewrites the value, which generation refuses as
// withValidation does: './sku#trimmedSkuSchema'.
export const trimmedSkuSchema = z.string().trim().toUpperCase();
