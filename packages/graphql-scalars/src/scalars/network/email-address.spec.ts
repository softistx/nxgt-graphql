import { describe } from 'bun:test';
import { scalarCases } from '../../../test/scalar-cases';
import { EmailAddressScalar } from './email-address';

describe('EmailAddress', () => {
	scalarCases(EmailAddressScalar, {
		accepted: [
			'ada@example.com',
			'a.b+c@sub.example.org',
			"o'brien@example.com",
			'u@x.xn--p1ai',
			'ADA@EXAMPLE.COM',
			`u@${'a'.repeat(63)}.com`,
		],
		refused: [
			'u@x.c0m',
			'u@x.a-b',
			'u@x.y',
			'ada',
			'ada@',
			'@example.com',
			'a b@example.com',
			'.a@example.com',
			'a.@example.com',
			'a@b@example.com',
			'u@a-.com',
			'u@-a.com',
			'u@a_b.com',
			`u@${'a'.repeat(64)}.com`,
			`u@${'a.'.repeat(126)}com`,
			'u@localhost',
			'u@example.com.',
			'u@example.123',
			'u@1.2.3.4',
			'u@[127.0.0.1]',
			'u@bücher.example',
			42,
		],
	});
});
