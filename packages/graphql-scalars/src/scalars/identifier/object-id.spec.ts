import { describe } from 'bun:test';
import { scalarCases } from '../../../test/scalar-cases';
import { ObjectIDScalar } from './object-id';

describe('ObjectID', () => {
	scalarCases(ObjectIDScalar, {
		accepted: ['507f1f77bcf86cd799439011', '507F1F77BCF86CD799439011'],
		refused: [
			'507f1f77bcf86cd79943901',
			'507f1f77bcf86cd7994390111',
			'507f1f77bcf86cd79943901g',
			' 507f1f77bcf86cd799439011',
			'',
		],
	});
});
