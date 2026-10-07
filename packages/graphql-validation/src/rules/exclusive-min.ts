import { defineRule } from './rule';

export const exclusiveMinRule = defineRule({
	argument: 'exclusiveMin',
	type: 'Float',
	target: 'number',
	toZod: (schema, value) => schema.gt(value),
	toCode: (schema, value) => `${schema}.gt(${value})`,
});
