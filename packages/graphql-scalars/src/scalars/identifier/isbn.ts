import { z } from 'zod';
import { zodScalar } from '../../zod-scalar';

/**
 * Whether `value` is an ISBN-10 or ISBN-13 with its check digit right, written
 * as digits only (an ISBN-10 may end in `X`, uppercase). 979-0 belongs to
 * the ISMN (music), not to ISBNs.
 */
function isIsbn(value: string): boolean {
	if (/^\d{9}[\dX]$/.test(value)) {
		let sum = 0;
		for (let i = 0; i < 10; i++) {
			const char = value[i] as string;
			sum += (10 - i) * (char === 'X' ? 10 : Number(char));
		}
		return sum % 11 === 0;
	}
	if (/^(978\d|979[1-9])\d{9}$/.test(value)) {
		let sum = 0;
		for (let i = 0; i < 13; i++)
			sum += (i % 2 === 0 ? 1 : 3) * Number(value[i]);
		return sum % 10 === 0;
	}
	return false;
}

/**
 * An ISBN-10 or ISBN-13, digits only (no hyphen or space), its check digit
 * verified. An ISBN-10 may end in an uppercase `X`; an ISBN-13 starts with
 * 978 or 979 (not 979-0, the ISMN).
 */
export const isbnSchema = z.string().refine(isIsbn, { error: 'Invalid ISBN' });

export const ISBNScalar = zodScalar(isbnSchema, {
	name: 'ISBN',
	description:
		'An ISBN-10 or ISBN-13, digits only, with its check digit verified.',
	specifiedByURL:
		'https://www.isbn-international.org/content/isbn-users-manual/29',
});
