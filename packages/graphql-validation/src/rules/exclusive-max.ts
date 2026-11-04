import { defineRule } from './rule';

export const exclusiveMaxRule = defineRule({
	argument: 'exclusiveMax',
	type: 'Float',
	target: 'number',
	description:
		'The number must be strictly less than this value (the value itself is refused). Refused otherwise with a BAD_USER_INPUT error naming the constraint. Applies to Int and Float values.',
	toZod: (schema, value) => schema.lt(value),
	toCode: (schema, value) => `${schema}.lt(${value})`,
	owns: (issue) =>
		issue.code === 'too_big' &&
		issue.origin === 'number' &&
		issue.inclusive === false,
});
