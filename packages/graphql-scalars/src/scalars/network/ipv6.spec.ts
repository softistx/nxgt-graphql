import { describe } from 'bun:test';
import { scalarCases } from '../../../test/scalar-cases';
import { IPv6Scalar } from './ipv6';

describe('IPv6', () => {
	scalarCases(IPv6Scalar, {
		accepted: [
			'::',
			'2001:DB8::1',
			'::FFFF:192.0.2.1',
			'::1',
			'2001:db8::1',
			'2001:0db8:0000:0000:0000:0000:0000:0001',
			'::ffff:192.0.2.1',
		],
		refused: [
			'::1\n',
			'[::1]',
			'::ffff:192.168.000.1',
			'fe80::1%eth0',
			'2001:db8::g',
			'1.2.3.4',
			':::',
			1,
		],
	});
});
