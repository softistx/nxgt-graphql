import { formatNamed } from '../formats';
import { defineRule } from './rule';

// The string rules' own formats; every other invalid_format is a format's.
const NARROWING = new Set(['starts_with', 'ends_with', 'includes', 'regex']);

export const formatRule = defineRule({
	argument: 'format',
	type: 'String',
	target: 'string',
	base: true,
	toZod: (_schema, value) => formatNamed(value).toZod(),
	toCode: (_schema, value) => formatNamed(value).toCode(),
	owns: (issue) =>
		issue.code === 'invalid_format' && !NARROWING.has(issue.format ?? ''),
});
