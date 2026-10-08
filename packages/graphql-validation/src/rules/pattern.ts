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
	toZod: (schema, value) => schema.regex(compile(value)),
	toCode: (schema, value) =>
		`${schema}.regex(new RegExp(${literal(compile(value).source)}))`,
	owns: (issue) => issue.format === 'regex',
});
