import { defineRule } from './rule';

export const exclusiveMinRule = defineRule({
	argument: 'exclusiveMin',
	type: 'Float',
	target: 'number',
	toZod: (schema, value) => schema.gt(value),
	toCode: (schema, value) => `${schema}.gt(${value})`,
	owns: (issue) =>
		issue.code === 'too_small' &&
		issue.origin === 'number' &&
		issue.inclusive === false,
});
