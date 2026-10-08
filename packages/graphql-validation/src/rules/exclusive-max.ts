import { defineRule } from './rule';

export const exclusiveMaxRule = defineRule({
	argument: 'exclusiveMax',
	type: 'Float',
	target: 'number',
	toZod: (schema, value) => schema.lt(value),
	toCode: (schema, value) => `${schema}.lt(${value})`,
	owns: (issue) =>
		issue.code === 'too_big' &&
		issue.origin === 'number' &&
		issue.inclusive === false,
});
