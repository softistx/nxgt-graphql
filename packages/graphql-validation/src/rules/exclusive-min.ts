import { defineRule } from './rule';

export const exclusiveMinRule = defineRule({
	argument: 'exclusiveMin',
	type: 'Float',
	target: 'number',
	description:
		'The number must be strictly greater than this value (the value itself is refused). Refused otherwise with a BAD_USER_INPUT error naming the constraint. Applies to Int and Float values.',
	toZod: (schema, value) => schema.gt(value),
	toCode: (schema, value) => `${schema}.gt(${value})`,
	owns: (issue) =>
		issue.code === 'too_small' &&
		issue.origin === 'number' &&
		issue.inclusive === false,
});
