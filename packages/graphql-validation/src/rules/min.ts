import { defineRule } from './rule';

export const minRule = defineRule({
	argument: 'min',
	type: 'Float',
	target: 'number',
	description:
		'The number must be greater than or equal to this value (inclusive). Refused otherwise with a BAD_USER_INPUT error naming the constraint. Applies to Int and Float values.',
	toZod: (schema, value) => schema.gte(value),
	toCode: (schema, value) => `${schema}.gte(${value})`,
	owns: (issue) =>
		issue.code === 'too_small' &&
		issue.origin === 'number' &&
		issue.inclusive === true,
});
