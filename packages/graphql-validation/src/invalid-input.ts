import { GraphQLError, type GraphQLErrorOptions } from 'graphql';

/** The code of the error `invalidInputError` builds, and its default message. */
export const INVALID_INPUT = 'validation.errors.invalid-input';

/** Values a message is built from, such as `{ min: 2 }`. */
export type IssueParams = Record<string, string | number>;

/** One field at fault: where it is, why, and what the reason's message needs. */
export interface FieldIssue {
	/** The field inside the input, dotted: `person.firstName`, `tags.1`. */
	readonly path: string;
	/** A code your client and your translations know: `validation.errors.too-short`. */
	readonly code: string;
	/** Values the message needs; an object with no key counts as none. */
	readonly params?: IssueParams;
}

/** One entry of `extensions.fields`: a `FieldIssue` with its message. */
export interface FieldError {
	readonly path: string;
	readonly code: string;
	/** `translate(code, params)`, or the code itself without a translator. */
	readonly message: string;
	/** Present only when the issue had params with at least one key. */
	readonly params?: IssueParams;
}

/** Turns a code (and its params) into the text a person reads. */
export type Translate = (code: string, params?: IssueParams) => string;

/** The options of `invalidInputError`: GraphQL's own, and a translator. */
export type InvalidInputOptions = GraphQLErrorOptions & {
	readonly translate?: Translate;
};

/** The options of `fieldsError`: also an HTTP status and the error's own params. */
export type FieldsErrorOptions = InvalidInputOptions & {
	/** `extensions.http.status`, for a server that reads it (409, ...). */
	readonly status?: number;
	readonly params?: IssueParams;
};

/** `params` itself, or `undefined` when it holds no key: never `{}`. */
function paramsOf(params: IssueParams | undefined): IssueParams | undefined {
	return params && Object.keys(params).length > 0 ? params : undefined;
}

function messageOf(
	code: string,
	params: IssueParams | undefined,
	translate: Translate | undefined,
): string {
	return translate?.(code, params) ?? code;
}

function fieldsOf(
	issues: readonly FieldIssue[],
	translate: Translate | undefined,
): FieldError[] {
	return issues.map(({ path, code, params: given }) => {
		const params = paramsOf(given);
		return {
			path,
			code,
			message: messageOf(code, params, translate),
			...(params && { params }),
		};
	});
}

/**
 * One 400 error listing every field at fault, for an API that answers invalid
 * input this way: `extensions` is `{ code: 'validation.errors.invalid-input',
 * http: { status: 400 }, fields }`, each field with its translated message
 * (the code itself without `translate`), in the order given. GraphQL's
 * options (`originalError`, `path`, `nodes`, ...) are kept; an `extensions`
 * among them is replaced by this one.
 */
export function invalidInputError(
	issues: readonly FieldIssue[],
	options: InvalidInputOptions = {},
): GraphQLError {
	const { translate, ...graphql } = options;
	return new GraphQLError(messageOf(INVALID_INPUT, undefined, translate), {
		...graphql,
		extensions: {
			code: INVALID_INPUT,
			http: { status: 400 },
			fields: fieldsOf(issues, translate),
		},
	});
}

/**
 * A refusal of your own (a 409 conflict, say) that names the fields at
 * fault: `extensions` is `{ code, params?, http?: { status }, fields }`, the
 * fields worded as `invalidInputError` words them, the message
 * `translate(code, params)` or the code. An `extensions` among the options
 * is replaced by this one.
 */
export function fieldsError(
	code: string,
	issues: readonly FieldIssue[],
	options: FieldsErrorOptions = {},
): GraphQLError {
	const { translate, status, params: given, ...graphql } = options;
	const params = paramsOf(given);
	return new GraphQLError(messageOf(code, params, translate), {
		...graphql,
		extensions: {
			code,
			...(params && { params }),
			...(status && { http: { status } }),
			fields: fieldsOf(issues, translate),
		},
	});
}

/**
 * A GraphQL or Zod path as a `FieldIssue` path: dotted, without the leading
 * `input` argument when a field follows it, a symbol written as
 * `String(key)`. `['input', 'person', 'firstName']` is `person.firstName`,
 * `['input', 'tags', 1]` is `tags.1`, `['first']` and `['input']` stay as
 * they are.
 */
export function inputPath(path: readonly PropertyKey[]): string {
	const [first, ...rest] = path;
	return (first === 'input' && rest.length > 0 ? rest : path)
		.map((key) => String(key))
		.join('.');
}
