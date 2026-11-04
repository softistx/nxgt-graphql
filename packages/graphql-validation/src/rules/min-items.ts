import { defineRule } from './rule';

export const minItemsRule = defineRule({
	argument: 'minItems',
	type: 'Int',
	target: 'list',
	description:
		'The list must hold at least this many items (inclusive). Refused otherwise with a BAD_USER_INPUT error naming the constraint. Applies to list values.',
	toZod: (schema, value) => schema.min(value),
	toCode: (schema, value) => `${schema}.min(${value})`,
	owns: (issue) => issue.code === 'too_small' && issue.origin === 'array',
});
