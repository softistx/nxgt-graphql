import { DateScalar, date } from './date';
import { DateTimeScalar, dateTime } from './date-time';
import { EmailAddressScalar, emailAddress } from './email-address';
import { NonEmptyStringScalar, nonEmptyString } from './non-empty-string';
import { PositiveIntScalar, positiveInt } from './positive-int';
import { URLScalar, url } from './url';
import { UUIDScalar, uuid } from './uuid';

export {
	DateScalar,
	DateTimeScalar,
	EmailAddressScalar,
	NonEmptyStringScalar,
	PositiveIntScalar,
	URLScalar,
	UUIDScalar,
};

/**
 * The schemas behind the scalars, exported so an application validates a
 * value the way the API does — in a form, a REST handler or a job — with the
 * same rule and the same `z.input`/`z.output` types.
 */
export const schemas = {
	dateTime,
	date,
	emailAddress,
	url,
	uuid,
	nonEmptyString,
	positiveInt,
};

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
