import { defineRule, literal } from './rule';

export const containsRule = defineRule({
	argument: 'contains',
	type: 'String',
	target: 'string',
	toZod: (schema, value) => schema.includes(value),
	toCode: (schema, value) => `${schema}.includes(${literal(value)})`,
	owns: (issue) => issue.format === 'includes',
});
