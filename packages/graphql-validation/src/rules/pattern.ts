import { defineRule, literal } from './rule';

/** The pattern as a RegExp, or an error that names the argument. */
function compile(value: string): RegExp {
	try {
		return new RegExp(value);
	} catch (error) {
		throw new Error(
			`Invalid @constraint pattern ${literal(value)}: ${(error as Error).message}`,
		);
	}
}

export const patternRule = defineRule({
	argument: 'pattern',
	type: 'String',
	target: 'string',
	description:
		'The string must match this regular expression (JavaScript syntax, not anchored unless it uses ^ and $). An invalid expression fails at server startup. Refused otherwise with a BAD_USER_INPUT error naming the constraint. Applies to String values.',
	toZod: (schema, value) => schema.regex(compile(value)),
	toCode: (schema, value) =>
		`${schema}.regex(new RegExp(${literal(compile(value).source)}))`,
	owns: (issue) => issue.format === 'regex',
});
