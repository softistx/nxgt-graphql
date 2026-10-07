import { describe, expect, test } from 'bun:test';
import { scalarCases } from '../../../test/scalar-cases';
import { URLScalar } from './url';

describe('URL', () => {
	scalarCases(URLScalar, {
		accepted: ['https://example.com/a?b=c', 'http://localhost:3000'],
		refused: [
			'javascript:alert(1)',
			'data:text/plain,x',
			'mailto:a@b.c',
			'example.com',
			'https:example.com',
			'http:/x',
			'',
		],
	});

	test('trims the value and drops tabs and line breaks, as z.url() does', () => {
		expect(URLScalar.parseValue(' https://x.com\n')).toBe('https://x.com');
		expect(URLScalar.serialize('https://x.com\t')).toBe('https://x.com');
	});
});
