/** Values a message interpolates: `{ retryAfter: 30 }`. */
export type ApiErrorParams = Readonly<Record<string, string | number>>;

/** One refused field: its path inside the input, as the API sends it. */
export interface ApiFieldError {
	/** `person.firstName`, `ids.3`: a string, dotted, kept as the API sends it. */
	readonly path: string;
	readonly code: string;
	readonly message: string;
	readonly params?: ApiErrorParams;
}

/** An error's `extensions`: what an API puts there, read as it is. */
export type ApiErrorExtensions = {
	readonly code?: string;
	readonly http?: { readonly status?: number };
	readonly params?: ApiErrorParams;
	readonly fields?: readonly ApiFieldError[];
	readonly [key: string]: unknown;
};

/** One entry of a response's `errors`. */
export interface ApiErrorEntry {
	readonly message: string;
	readonly path?: readonly (string | number)[];
	readonly locations?: readonly {
		readonly line: number;
		readonly column: number;
	}[];
	readonly extensions?: ApiErrorExtensions;
}

/**
 * The response carried `errors`. Its summaries read the first error, the one
 * the API put first; `errors` keeps them all, and `data` what was resolved
 * despite them.
 */
export class ApiError extends Error {
	override name = 'ApiError';
	readonly errors: readonly ApiErrorEntry[];
	/** The response's `data`, when the API resolved part of it. */
	readonly data: unknown;
	/** The HTTP status the response came with. */
	readonly httpStatus: number;

	constructor(
		errors: readonly ApiErrorEntry[],
		data: unknown,
		httpStatus: number,
	) {
		super(errors[0]?.message ?? 'Unknown GraphQL error');
		this.errors = errors;
		this.data = data;
		this.httpStatus = httpStatus;
	}

	/** The first error's `extensions`, every key of them. */
	get extensions(): ApiErrorExtensions {
		return this.errors[0]?.extensions ?? {};
	}

	/** `extensions.code`: `auth.errors.invalid-credentials`, `BAD_USER_INPUT`… */
	get code(): string | undefined {
		return this.extensions.code;
	}

	/** `extensions.http.status`, else the HTTP status of the response. */
	get status(): number {
		return this.extensions.http?.status ?? this.httpStatus;
	}

	get params(): ApiErrorParams {
		return this.extensions.params ?? {};
	}

	/**
	 * The refused fields: `extensions.fields` as the API sends them, else
	 * `@nxgt/graphql-validation`'s `extensions.issues`, their path joined
	 * with dots.
	 */
	get fields(): readonly ApiFieldError[] {
		const { fields, issues } = this.extensions;
		if (Array.isArray(fields)) return fields;
		if (Array.isArray(issues)) return issues.flatMap(fieldOfIssue);
		return [];
	}
}

function fieldOfIssue(issue: unknown): ApiFieldError[] {
	if (typeof issue !== 'object' || issue === null) return [];
	const { path, code, message } = issue as Record<string, unknown>;
	return [
		{
			path: Array.isArray(path) ? path.join('.') : String(path ?? ''),
			code: String(code ?? ''),
			message: String(message ?? ''),
		},
	];
}

/** A status that is not a success, with no GraphQL body: 401, 403, 404, a gateway's 503. */
export class ApiStatusError extends Error {
	override name = 'ApiStatusError';
	readonly status: number;
	/** The body, read by its media type, when there was one. */
	readonly body: unknown;

	constructor(status: number, body: unknown, options?: ErrorOptions) {
		super(`The API answered ${status} with no GraphQL response`, options);
		this.status = status;
		this.body = body;
	}
}

/** Why the API gave no answer to read. */
export type UnavailableReason = 'unreachable' | 'timeout' | 'invalid-response';

/**
 * No GraphQL answer: the API could not be reached, did not answer in time,
 * or answered a success that holds neither `data` nor `errors`.
 */
export class ApiUnavailableError extends Error {
	override name = 'ApiUnavailableError';
	readonly reason: UnavailableReason;

	constructor(reason: UnavailableReason, options?: ErrorOptions) {
		super(unavailableMessages[reason], options);
		this.reason = reason;
	}
}

const unavailableMessages: Record<UnavailableReason, string> = {
	unreachable: 'The API could not be reached',
	timeout: 'The API did not answer in time',
	'invalid-response': 'The API answered with neither data nor errors',
};

/**
 * True for an `ApiError`, including one from another copy of this package
 * (a second install in `node_modules`), where `instanceof` fails.
 */
export function isApiError(error: unknown): error is ApiError {
	return (
		error instanceof ApiError ||
		(error instanceof Error &&
			error.name === 'ApiError' &&
			Array.isArray((error as ApiError).errors))
	);
}
