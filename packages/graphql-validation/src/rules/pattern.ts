import { defineRule, literal } from './rule';

export const patternRule = defineRule({
	argument: 'pattern',
	type: 'String',
	target: 'string',
	toZod: (schema, value) => schema.regex(new RegExp(value)),
	toCode: (schema, value) => `${schema}.regex(new RegExp(${literal(value)}))`,
});
