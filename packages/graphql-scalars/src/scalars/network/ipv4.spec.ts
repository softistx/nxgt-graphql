import { describe } from 'bun:test';
import { scalarCases } from '../../../test/scalar-cases';
import { IPv4Scalar } from './ipv4';

describe('IPv4', () => {
	scalarCases(IPv4Scalar, {
		accepted: ['192.168.0.1', '0.0.0.0', '255.255.255.255'],
		refused: [
			'127.1',
			'0x7f.0.0.1',
			'1.2.3.4 ',
			'256.0.0.1',
			'01.2.3.4',
			'1.2.3',
			' 1.2.3.4',
			'::1',
			1,
		],
	});
});
