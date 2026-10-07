import { defineRule, literal } from './rule';

export const endsWithRule = defineRule({
	argument: 'endsWith',
	type: 'String',
	target: 'string',
	toZod: (schema, value) => schema.endsWith(value),
	toCode: (schema, value) => `${schema}.endsWith(${literal(value)})`,
});
