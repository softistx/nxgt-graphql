import { defineRule } from './rule';

export const multipleOfRule = defineRule({
	argument: 'multipleOf',
	type: 'Float',
	target: 'number',
	toZod: (schema, value) => schema.multipleOf(value),
	toCode: (schema, value) => `${schema}.multipleOf(${value})`,
	owns: (issue) => issue.code === 'not_multiple_of',
});
