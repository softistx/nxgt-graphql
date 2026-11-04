import { defineRule, literal } from './rule';

export const startsWithRule = defineRule({
	argument: 'startsWith',
	type: 'String',
	target: 'string',
	description:
		'The string must start with this text (case-sensitive). Refused otherwise with a BAD_USER_INPUT error naming the constraint. Applies to String and ID values.',
	toZod: (schema, value) => schema.startsWith(value),
	toCode: (schema, value) => `${schema}.startsWith(${literal(value)})`,
	owns: (issue) => issue.format === 'starts_with',
});
