import { isbnSchema } from '@nxgt/zod/scalars';
import { zodScalar } from '../../zod-scalar';

export { isbnSchema };

export const ISBNScalar = zodScalar(isbnSchema, {
	name: 'ISBN',
	description:
		'An ISBN-10 or ISBN-13, digits only, with its check digit verified.',
	specifiedByURL:
		'https://www.isbn-international.org/content/isbn-users-manual/29',
});
