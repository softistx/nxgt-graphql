import { defineRule } from './rule';

export const minLengthRule = defineRule({
	argument: 'minLength',
	type: 'Int',
	target: 'string',
	description:
		'The string must be at least this many characters long (UTF-16 code units, inclusive). Refused otherwise with a BAD_USER_INPUT error naming the constraint. Applies to String values.',
	toZod: (schema, value) => schema.min(value),
	toCode: (schema, value) => `${schema}.min(${value})`,
	owns: (issue) => issue.code === 'too_small' && issue.origin === 'string',
});
