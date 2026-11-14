import { GraphQLError } from 'graphql';
import type { ValidationIssue } from './bad-user-input';
import { FIELD_CODES } from './field-issue-of';
import {
	type FieldIssue,
	type InvalidInputOptions,
	type IssueParams,
	inputPath,
	invalidInputError,
} from './invalid-input';
import type { ConstraintArgument } from './rules';

interface Kind {
	readonly code: string;
	/** The param the declared value is passed on as, when there is one. */
	readonly param?: string;
}

/** The code and the param of each `@constraint` argument; `pattern` has none, so a regex never reaches a client. */
const KINDS = {
	minLength: { code: FIELD_CODES.tooShort, param: 'min' },
	maxLength: { code: FIELD_CODES.tooLong, param: 'max' },
	min: { code: FIELD_CODES.outOfRange, param: 'min' },
	max: { code: FIELD_CODES.outOfRange, param: 'max' },
	exclusiveMin: { code: FIELD_CODES.outOfRange, param: 'exclusiveMin' },
	exclusiveMax: { code: FIELD_CODES.outOfRange, param: 'exclusiveMax' },
	multipleOf: { code: FIELD_CODES.outOfRange, param: 'multipleOf' },
	minItems: { code: FIELD_CODES.tooFew, param: 'min' },
	maxItems: { code: FIELD_CODES.tooMany, param: 'max' },
	format: { code: FIELD_CODES.invalidFormat, param: 'format' },
	pattern: { code: FIELD_CODES.invalidFormat },
} as const satisfies Partial<Record<ConstraintArgument, Kind>>;

function fieldOf(issue: ValidationIssue): FieldIssue {
	const kind: Kind | undefined = issue.constraint
		? (KINDS as Partial<Record<string, Kind>>)[issue.constraint]
		: undefined;
	const path = inputPath(issue.path);
	if (!kind) return { path, code: FIELD_CODES.invalid };
	const params: IssueParams | undefined =
		kind.param && issue.value !== undefined
			? { [kind.param]: issue.value }
			: undefined;
	return { path, code: kind.code, ...(params && { params }) };
}

/** The issues of a `BAD_USER_INPUT` error, direct or wrapped by graphql-js. */
function issuesOf(error: GraphQLError): readonly ValidationIssue[] | undefined {
	const source =
		error.extensions['code'] === 'BAD_USER_INPUT' ? error : error.originalError;
	if (!(source instanceof GraphQLError)) return undefined;
	if (source.extensions['code'] !== 'BAD_USER_INPUT') return undefined;
	const issues = source.extensions['issues'];
	return Array.isArray(issues) ? issues : undefined;
}

/**
 * The `invalidInputError` of a `@constraint` refusal: a `BAD_USER_INPUT`
 * error as `withValidation` / `validated` throw it, or one whose
 * `originalError` is (graphql-js wraps it with the field's location). Each
 * issue becomes a field `{ path, code, params }`: `too-short` / `too-long`
 * (`minLength`, `maxLength`), `out-of-range` (`min`, `max`, `exclusiveMin`,
 * `exclusiveMax`, `multipleOf`), `too-few` / `too-many` (`minItems`,
 * `maxItems`), `invalid-format` (`format`, `pattern`), `invalid` for the rest,
 * an issue with no `constraint` included. `params` is the declared value
 * under the argument's own key (`{ min }`, `{ max }`, `{ exclusiveMin }`,
 * `{ exclusiveMax }`, `{ multipleOf }`, `{ format }`), none for `pattern`.
 * The location (`nodes`, `source`, `positions`, `path`) is kept and
 * `originalError` is the error given. Any other error is returned as it is
 * (the same object).
 */
export function invalidInputOf(
	error: GraphQLError,
	options: Pick<InvalidInputOptions, 'translate'> = {},
): GraphQLError {
	const issues = issuesOf(error);
	if (!issues) return error;
	return invalidInputError(issues.map(fieldOf), {
		...options,
		nodes: error.nodes ?? null,
		source: error.source ?? null,
		positions: error.positions ?? null,
		path: error.path ?? null,
		originalError: error,
	});
}
