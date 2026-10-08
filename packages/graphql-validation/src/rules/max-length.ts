import { defineRule } from './rule';

export const maxLengthRule = defineRule({
	argument: 'maxLength',
	type: 'Int',
	target: 'string',
	toZod: (schema, value) => schema.max(value),
	toCode: (schema, value) => `${schema}.max(${value})`,
	owns: (issue) => issue.code === 'too_big' && issue.origin === 'string',
});
