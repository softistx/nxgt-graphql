import { z } from 'zod';

/**
 * A `Date` in the resolvers, an invalid one (`new Date(NaN)`) refused with
 * its own message: Zod's is "expected date, received Date".
 */
export function validDate() {
	return z.date({
		error: (issue) =>
			issue.input instanceof Date ? 'Invalid Date' : undefined,
	});
}
