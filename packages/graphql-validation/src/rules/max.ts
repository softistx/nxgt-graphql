import { defineRule } from './rule';

export const maxRule = defineRule({
	argument: 'max',
	type: 'Float',
	target: 'number',
	toZod: (schema, value) => schema.lte(value),
	toCode: (schema, value) => `${schema}.lte(${value})`,
	owns: (issue) =>
		issue.code === 'too_big' &&
		issue.origin === 'number' &&
		issue.inclusive === true,
});
