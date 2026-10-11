// One format exported alone, as zodFormats names it: './sku#skuSchema'.
import { z } from 'zod';

export const skuSchema = z.string().regex(/^SKU-[0-9]{4}$/, 'Invalid SKU');
