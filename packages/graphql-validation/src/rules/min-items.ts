import { defineRule } from './rule';

export const minItemsRule = defineRule({
	argument: 'minItems',
	type: 'Int',
	target: 'list',
	toZod: (schema, value) => schema.min(value),
	toCode: (schema, value) => `${schema}.min(${value})`,
});
