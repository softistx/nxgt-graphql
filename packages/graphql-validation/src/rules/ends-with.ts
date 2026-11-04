import { defineRule, literal } from './rule';

export const endsWithRule = defineRule({
	argument: 'endsWith',
	type: 'String',
	target: 'string',
	description:
		'The string must end with this text (case-sensitive). Refused otherwise with a BAD_USER_INPUT error naming the constraint. Applies to String and ID values.',
	toZod: (schema, value) => schema.endsWith(value),
	toCode: (schema, value) => `${schema}.endsWith(${literal(value)})`,
	owns: (issue) => issue.format === 'ends_with',
});
