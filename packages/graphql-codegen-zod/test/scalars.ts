// A scalarSchemas record, as @nxgt/graphql-scalars exports one.
import { z } from 'zod';

// DateTime is a codec, a string in and a Date out, as there.
export const scalarSchemas = {
	DateTime: z.codec(z.iso.datetime({ offset: true }), z.date(), {
		decode: (value) => new Date(value),
		encode: (date) => date.toISOString(),
	}),
};
