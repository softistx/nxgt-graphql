import { formatNamed } from '../formats';
import { defineRule } from './rule';

export const formatRule = defineRule({
	argument: 'format',
	type: 'String',
	target: 'string',
	base: true,
	toZod: (_schema, value) => formatNamed(value).toZod(),
	toCode: (_schema, value) => formatNamed(value).toCode(),
});
