import { describe } from 'bun:test';
import { scalarCases } from '../../../test/scalar-cases';
import { JWTScalar } from './jwt';

const part = (json: object): string =>
	Buffer.from(JSON.stringify(json)).toString('base64url');
const token = (
	header: object,
	payload: object = { sub: '1' },
	signature = 'c2ln',
) => `${part(header)}.${part(payload)}.${signature}`;

describe('JWT', () => {
	scalarCases(JWTScalar, {
		accepted: [
			'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.dozjgNryP4J3jVmNHl0w5N_XgL0n3I9PlFUP0THsR8U',
			token({ alg: 'RS256' }),
			token({ alg: 'ES256', typ: 'at+jwt' }),
			token({ alg: 'HS256', typ: 'jwt' }),
			// A header whose base64url holds `-` or `_`.
			token({ alg: 'RS256', jku: 'https://k.example/j?a=>>>~~~' }),
		],
		refused: [
			token({ alg: 'none' }),
			token({ alg: 'NONE' }),
			token({ alg: 'none' }, { sub: '1' }, ''),
			token({ alg: 1 }),
			token({ typ: 'JWT' }),
			`${part({ alg: 'HS256' })}.!!!not-base64!!!.c2ln`,
			`${part({ alg: 'HS256' })}..c2ln`,
			`${part({ alg: 'HS256' })}.${Buffer.from('"text"').toString('base64url')}.c2ln`,
			`${part({ alg: 'HS256' })}.${part({ sub: '1' })}.$$ $$`,
			// Padding, which base64url in a JWT never has.
			`${part({ alg: 'HS256', k: 'ab' })}=.${part({})}.c2ln`,
			token({ alg: 'HS256' }).concat('.x'),
			'a.b.c',
			'a.b',
			'',
			1,
		],
	});
});
