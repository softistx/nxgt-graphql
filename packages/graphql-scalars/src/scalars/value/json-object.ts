import { z } from 'zod';
import { isJsonObject } from '../../rules/json';
import { zodScalar } from '../../zod-scalar';

/**
 * A JSON object, kept as it is: a plain object whose every field is a JSON
 * value. An array, `null` or a scalar value is refused, and so is anything
 * `JSON` refuses.
 */
export const jsonObjectSchema = z
	.unknown()
	.refine(isJsonObject, { error: 'Expected a JSON object' });

export const JSONObjectScalar = zodScalar(jsonObjectSchema, {
	name: 'JSONObject',
	description: 'A JSON object.',
	specifiedByURL: 'https://www.rfc-editor.org/rfc/rfc8259#section-4',
	literals: 'any',
});
