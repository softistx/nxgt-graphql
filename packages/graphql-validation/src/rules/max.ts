import { defineRule } from './rule';

export const maxRule = defineRule({
	argument: 'max',
	type: 'Float',
	target: 'number',
	description:
		'The number must be less than or equal to this value (inclusive). Refused otherwise with a BAD_USER_INPUT error naming the constraint. Applies to Int and Float values.',
	toZod: (schema, value) => schema.lte(value),
	toCode: (schema, value) => `${schema}.lte(${value})`,
	owns: (issue) =>
		issue.code === 'too_big' &&
		issue.origin === 'number' &&
		issue.inclusive === true,
});
