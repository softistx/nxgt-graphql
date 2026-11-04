import { defineRule } from './rule';

export const maxLengthRule = defineRule({
	argument: 'maxLength',
	type: 'Int',
	target: 'string',
	description:
		'The string must be at most this many characters long (UTF-16 code units, inclusive). Refused otherwise with a BAD_USER_INPUT error naming the constraint. Applies to String and ID values.',
	toZod: (schema, value) => schema.max(value),
	toCode: (schema, value) => `${schema}.max(${value})`,
	owns: (issue) => issue.code === 'too_big' && issue.origin === 'string',
});
