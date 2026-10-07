import { describe } from 'bun:test';
import { scalarCases } from '../../../test/scalar-cases';
import { EmailAddressScalar } from './email-address';

describe('EmailAddress', () => {
	scalarCases(EmailAddressScalar, {
		accepted: ['ada@example.com', 'a.b+c@sub.example.org'],
		refused: ['ada', 'ada@', '@example.com', 'a b@example.com', 42],
	});
});
