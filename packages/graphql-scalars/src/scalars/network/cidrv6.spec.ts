import { describe } from 'bun:test';
import { scalarCases } from '../../../test/scalar-cases';
import { CIDRv6Scalar } from './cidrv6';

describe('CIDRv6', () => {
	scalarCases(CIDRv6Scalar, {
		accepted: [
			'2001:db8::1/32',
			'2001:DB8::/32',
			'2001:db8::/32',
			'::/0',
			'::1/128',
			'2001:dB8::aBcD/64',
		],
		refused: ['::/01', '2001:db8::/129', '2001:db8::', '10.0.0.0/8'],
	});
});
