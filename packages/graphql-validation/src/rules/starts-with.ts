import { defineRule, literal } from './rule';

export const startsWithRule = defineRule({
	argument: 'startsWith',
	type: 'String',
	target: 'string',
	toZod: (schema, value) => schema.startsWith(value),
	toCode: (schema, value) => `${schema}.startsWith(${literal(value)})`,
	owns: (issue) => issue.format === 'starts_with',
});
