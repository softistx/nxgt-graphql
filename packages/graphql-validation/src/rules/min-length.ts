import { defineRule } from './rule';

export const minLengthRule = defineRule({
	argument: 'minLength',
	type: 'Int',
	target: 'string',
	toZod: (schema, value) => schema.min(value),
	toCode: (schema, value) => `${schema}.min(${value})`,
});
