import { defineRule, RULE_PARAM } from './rule';

// The string rules' own formats; every other invalid_format is a format's.
const NARROWING = new Set(['starts_with', 'ends_with', 'includes', 'regex']);

export const formatRule = defineRule({
	argument: 'format',
	type: 'String',
	target: 'string',
	base: true,
	toZod: (_schema, value, { formats }) => formats.named(value).toZod(),
	toCode: (_schema, value, { formats }) => {
		const format = formats.named(value);
		if (format.toCode) return format.toCode();
		throw new Error(
			`@constraint(format: "${value}") is one of the application's formats: its source is the code generator's to write.`,
		);
	},
	// An application format's issues are marked, whatever their code
	// (`custom` for a `.refine()`): see FormatRegistry.
	owns: (issue) =>
		issue.params?.[RULE_PARAM] === 'format' ||
		(issue.code === 'invalid_format' && !NARROWING.has(issue.format ?? '')),
});
