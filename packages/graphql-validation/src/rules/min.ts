import { defineRule } from './rule';

export const minRule = defineRule({
	argument: 'min',
	type: 'Float',
	target: 'number',
	toZod: (schema, value) => schema.gte(value),
	toCode: (schema, value) => `${schema}.gte(${value})`,
	owns: (issue) =>
		issue.code === 'too_small' &&
		issue.origin === 'number' &&
		issue.inclusive === true,
});
