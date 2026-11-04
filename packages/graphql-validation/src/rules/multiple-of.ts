import { defineRule } from './rule';

export const multipleOfRule = defineRule({
	argument: 'multipleOf',
	type: 'Float',
	target: 'number',
	description:
		'The number must be a whole multiple of this value (for example 5 accepts 0, 5 and 10). Refused otherwise with a BAD_USER_INPUT error naming the constraint. Applies to Int and Float values.',
	toZod: (schema, value) => schema.multipleOf(value),
	toCode: (schema, value) => `${schema}.multipleOf(${value})`,
	owns: (issue) => issue.code === 'not_multiple_of',
});
