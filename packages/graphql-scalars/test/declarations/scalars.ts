// An application's own scalars, behind exported values whose types are
// inferred: a declaration build must be able to name each one through
// `@nxgt/graphql-scalars` and its peers alone (TS2883 otherwise).
import {
	DateTimeScalar,
	pickScalars,
	scalarResolvers,
	scalarSchemas,
	schemas,
	urlSchema,
	zodScalar,
} from '@nxgt/graphql-scalars';
import { z } from 'zod';

export const Cents = zodScalar(
	z.codec(z.int().nonnegative(), z.bigint(), {
		decode: (n) => BigInt(n),
		encode: (b) => Number(b),
	}),
	{ name: 'Cents' },
);

export const Slug = zodScalar(z.string().regex(/^[a-z-]+$/), { name: 'Slug' });

export const scalars = { DateTime: DateTimeScalar, Cents, Slug };

export const signUp = z.object({
	email: schemas.emailAddress,
	birthday: schemas.date,
});

export const picked = pickScalars('DateTime', 'URL');

export const every = scalarResolvers;

export const link = urlSchema;

export const generated = z.object({
	id: scalarSchemas.UUID,
	at: scalarSchemas.DateTime,
});

export const ownSchema = Cents.schema;

// A schema whose type came out `any` (a dependency's `.d.ts` that does not
// resolve under the consumer's settings) would be taken as a number: these
// must stay errors.
// @ts-expect-error a schema is never a number
export const notAnyRecord: number = scalarSchemas.UUID;
// @ts-expect-error a schema is never a number
export const notAnySchemas: number = schemas.emailAddress;
