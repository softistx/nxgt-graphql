import { z } from 'zod';
import { defineFormat } from './format';

// RFC 3339 with an offset, in its canonical spelling only: an uppercase `T`
// and `Z`, seconds present. graphql-constraint-directive (validator's
// isRFC3339) also takes a lowercase `t`, `z` or a space.
export const dateTimeFormat = defineFormat({
	name: 'date-time',
	toZod: () => z.iso.datetime({ offset: true }),
	toCode: () => 'z.iso.datetime({ offset: true })',
});
