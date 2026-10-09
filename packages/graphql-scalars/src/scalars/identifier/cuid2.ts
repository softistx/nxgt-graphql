import { cuid2Schema } from '@nxgt/zod/scalars';
import { zodScalar } from '../../zod-scalar';

export { cuid2Schema };

export const Cuid2Scalar = zodScalar(cuid2Schema, {
	name: 'Cuid2',
	description:
		'A cuid2: a lowercase letter, then lowercase letters and digits, 2 to 32 in all.',
	specifiedByURL: 'https://github.com/paralleldrive/cuid2',
});
