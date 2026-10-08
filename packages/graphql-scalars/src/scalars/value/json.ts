import { z } from 'zod';
import { isJsonValue } from '../../rules/json';
import { zodScalar } from '../../zod-scalar';

/**
 * Any JSON value, kept as it is: `null`, a boolean, a string, a finite
 * number, an array or a plain object of them. A query literal of any kind
 * is read, objects and lists included. What JSON cannot write back as it
 * is (a cycle, `undefined`, a `Date`, `NaN`, `-0`) is refused, both ways.
 */
export const jsonSchema = z
	.unknown()
	.refine(isJsonValue, { error: 'Invalid JSON value' });

export const JSONScalar = zodScalar(jsonSchema, {
	name: 'JSON',
	description: 'Any JSON value.',
	specifiedByURL: 'https://www.rfc-editor.org/rfc/rfc8259',
	literals: 'any',
});
