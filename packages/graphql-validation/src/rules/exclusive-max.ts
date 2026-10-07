import { defineRule } from './rule';

export const exclusiveMaxRule = defineRule({
	argument: 'exclusiveMax',
	type: 'Float',
	target: 'number',
	toZod: (schema, value) => schema.lt(value),
	toCode: (schema, value) => `${schema}.lt(${value})`,
});
