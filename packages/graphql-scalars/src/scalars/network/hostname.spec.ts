import { describe } from 'bun:test';
import { scalarCases } from '../../../test/scalar-cases';
import { HostnameScalar } from './hostname';

// 253 characters, the longest a host name can be: four labels, dots between.
const LONGEST = `${'a'.repeat(63)}.${'b'.repeat(63)}.${'c'.repeat(63)}.${'d'.repeat(61)}`;

describe('Hostname', () => {
	scalarCases(HostnameScalar, {
		accepted: [
			`${'a'.repeat(63)}.com`,
			LONGEST,
			`${LONGEST}.`,
			'xn--bcher-kva.example',
			'EXAMPLE.COM',
			'example.com',
			'api.example.com',
			'localhost',
			'example.com.',
			'0x.example',
			'a.0xg',
			'a.1a',
		],
		refused: [
			`${LONGEST}a`,
			'bücher.example',
			'1.2.3.4',
			'example.123',
			'123',
			'1.2.3.4.',
			'a.0x7f',
			'a.0X',
			'0x7f.',
			'-example.com',
			'exa_mple.com',
			'exa mple.com',
			'',
			`${'a'.repeat(64)}.com`,
		],
	});
});
