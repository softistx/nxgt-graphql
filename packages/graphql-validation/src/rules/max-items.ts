import { defineRule } from './rule';

export const maxItemsRule = defineRule({
	argument: 'maxItems',
	type: 'Int',
	target: 'list',
	description:
		'The list must hold at most this many items (inclusive). Refused otherwise with a BAD_USER_INPUT error naming the constraint. Applies to list values.',
	toZod: (schema, value) => schema.max(value),
	toCode: (schema, value) => `${schema}.max(${value})`,
	owns: (issue) => issue.code === 'too_big' && issue.origin === 'array',
});
