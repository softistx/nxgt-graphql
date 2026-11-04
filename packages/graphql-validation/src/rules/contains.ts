import { defineRule, literal } from './rule';

export const containsRule = defineRule({
	argument: 'contains',
	type: 'String',
	target: 'string',
	description:
		'The string must contain this text (case-sensitive). Refused otherwise with a BAD_USER_INPUT error naming the constraint. Applies to String values.',
	toZod: (schema, value) => schema.includes(value),
	toCode: (schema, value) => `${schema}.includes(${literal(value)})`,
	owns: (issue) => issue.format === 'includes',
});
