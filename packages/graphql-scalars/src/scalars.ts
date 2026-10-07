import { z } from 'zod';
import { zodScalar } from './zod-scalar';

/**
 * The schemas behind the scalars, exported so an application validates a
 * value the way the API does — in a form, a REST handler or a job — with the
 * same rule and the same `z.input`/`z.output` types.
 */
export const schemas = {
	/**
	 * An RFC 3339 date-time with its offset (`Z` or `±hh:mm`) on the wire, a
	 * `Date` in the resolvers. A time with no offset is refused: it names no
	 * instant. The way out writes `toISOString()`, so always in UTC.
	 */
	dateTime: z.codec(
		z.iso.datetime({ offset: true }),
		// Zod's own message for `new Date(NaN)` is "expected date, received Date".
		z.date({
			error: (issue) =>
				issue.input instanceof Date ? 'Invalid Date' : undefined,
		}),
		{
			decode: (text) => new Date(text),
			encode: (date) => date.toISOString(),
		},
	),
	/**
	 * A calendar date, `YYYY-MM-DD`, kept a string on both sides: a `Date` is
	 * an instant, and turning a birthday into one shifts it by a day in half
	 * the time zones. An impossible day (`2021-02-30`) is refused.
	 */
	date: z.iso.date(),
	emailAddress: z.email(),
	/**
	 * An absolute `http:` or `https:` URL. Other schemes are refused —
	 * `javascript:` and `data:` among them — since a client is likely to put
	 * the value in an `href`. Like `z.url()`, it trims the value and drops
	 * tabs and line breaks, both ways.
	 */
	// Exactly `^https?$`: Zod reads this source to also refuse
	// `https:example.com` and `http:/x`, which a looser pattern lets through.
	url: z.url({ protocol: /^https?$/ }),
	uuid: z.uuid(),
	/** A string with at least one character that is not white space. */
	nonEmptyString: z.string().regex(/\S/, 'Must not be empty or blank'),
	/** 1 to 2³¹ − 1: GraphQL's `Int` is 32 bits, so this is too. */
	positiveInt: z.int32().positive(),
};

export const DateTimeScalar = zodScalar(schemas.dateTime, {
	name: 'DateTime',
	description: 'An instant: an RFC 3339 date-time with its offset.',
	specifiedByURL: 'https://www.rfc-editor.org/rfc/rfc3339',
});

export const DateScalar = zodScalar(schemas.date, {
	name: 'Date',
	description: 'A calendar date, YYYY-MM-DD, with no time and no time zone.',
	specifiedByURL: 'https://www.rfc-editor.org/rfc/rfc3339',
});

export const EmailAddressScalar = zodScalar(schemas.emailAddress, {
	name: 'EmailAddress',
	description: 'An email address.',
});

export const URLScalar = zodScalar(schemas.url, {
	name: 'URL',
	description: 'An absolute http or https URL.',
	specifiedByURL: 'https://url.spec.whatwg.org/',
});

export const UUIDScalar = zodScalar(schemas.uuid, {
	name: 'UUID',
	description: 'A UUID in its 8-4-4-4-12 hexadecimal form.',
	specifiedByURL: 'https://www.rfc-editor.org/rfc/rfc9562',
});

export const NonEmptyStringScalar = zodScalar(schemas.nonEmptyString, {
	name: 'NonEmptyString',
	description: 'A string that is not empty and not only white space.',
});

export const PositiveIntScalar = zodScalar(schemas.positiveInt, {
	name: 'PositiveInt',
	description: 'An integer from 1 to 2147483647.',
});

/**
 * Every scalar of this package, keyed by its GraphQL name: the `resolvers`
 * entry a schema-first server (`makeExecutableSchema`, Yoga, Apollo) takes
 * beside {@link scalarTypeDefs}.
 */
export const scalarResolvers = {
	DateTime: DateTimeScalar,
	Date: DateScalar,
	EmailAddress: EmailAddressScalar,
	URL: URLScalar,
	UUID: UUIDScalar,
	NonEmptyString: NonEmptyStringScalar,
	PositiveInt: PositiveIntScalar,
};

/** The SDL that declares every scalar of {@link scalarResolvers}. */
export const scalarTypeDefs: string = Object.values(scalarResolvers)
	.map((scalar) =>
		scalar.specifiedByURL === null || scalar.specifiedByURL === undefined
			? `scalar ${scalar.name}`
			: `scalar ${scalar.name} @specifiedBy(url: "${scalar.specifiedByURL}")`,
	)
	.join('\n');
