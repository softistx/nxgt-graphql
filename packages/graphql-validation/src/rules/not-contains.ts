import { defineRule, literal } from './rule';

const message = (value: string) => `Must not contain ${literal(value)}`;

export const notContainsRule = defineRule({
	argument: 'notContains',
	type: 'String',
	target: 'string',
	// `refine` keeps the schema's own type, so later rules still chain.
	toZod: (schema, value) =>
		schema.refine((input) => !input.includes(value), message(value)),
	toCode: (schema, value) =>
		`${schema}.refine((input) => !input.includes(${literal(value)}), ${literal(message(value))})`,
});
