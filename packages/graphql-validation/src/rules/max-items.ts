import { defineRule } from './rule';

export const maxItemsRule = defineRule({
	argument: 'maxItems',
	type: 'Int',
	target: 'list',
	toZod: (schema, value) => schema.max(value),
	toCode: (schema, value) => `${schema}.max(${value})`,
	owns: (issue) => issue.code === 'too_big' && issue.origin === 'array',
});
