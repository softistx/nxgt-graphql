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

/** The code and the name of the bound each `@constraint` argument gives. */
const KINDS: Readonly<
	Record<string, { code: string; bound?: 'min' | 'max' } | undefined>
> = {
	minLength: { code: FIELD_CODES.tooShort, bound: 'min' },
	maxLength: { code: FIELD_CODES.tooLong, bound: 'max' },
	min: { code: FIELD_CODES.outOfRange, bound: 'min' },
	exclusiveMin: { code: FIELD_CODES.outOfRange, bound: 'min' },
	max: { code: FIELD_CODES.outOfRange, bound: 'max' },
	exclusiveMax: { code: FIELD_CODES.outOfRange, bound: 'max' },
	multipleOf: { code: FIELD_CODES.outOfRange },
	minItems: { code: FIELD_CODES.tooFew, bound: 'min' },
	maxItems: { code: FIELD_CODES.tooMany, bound: 'max' },
	format: { code: FIELD_CODES.invalidFormat },
	pattern: { code: FIELD_CODES.invalidFormat },
};

function fieldOf(issue: ValidationIssue): FieldIssue {
	const kind = issue.constraint && KINDS[issue.constraint];
	const path = inputPath(issue.path);
	if (!kind) return { path, code: FIELD_CODES.invalid };
	const params: IssueParams | undefined =
		kind.bound && issue.value !== undefined
			? { [kind.bound]: issue.value }
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
 * error as `withValidation` / `validated` throw it, or as graphql-js wraps it
 * with the field's location (`originalError`). Each issue becomes a field
 * `{ path, code, params }`: `too-short` / `too-long` (`minLength`,
 * `maxLength`), `out-of-range` (`min`, `max`, their exclusive forms,
 * `multipleOf`), `too-few` / `too-many` (`minItems`, `maxItems`),
 * `invalid-format` (`format`, `pattern`), `invalid` for the rest, an issue
 * with no `constraint` included. `params` carries the declared bound, `{ min }`
 * or `{ max }`, when the constraint has one. The location (`nodes`, `source`,
 * `positions`, `path`) is kept and `originalError` is the error given. Any
 * other error is returned as it is.
 */
export function constraintInvalidInput(
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
