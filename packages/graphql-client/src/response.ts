import type { AnyReply } from '@nxgt/httpyz';
import {
	ApiError,
	type ApiErrorEntry,
	ApiStatusError,
	ApiUnavailableError,
} from './errors';

/**
 * A response's `data`, or the error it stands for: `body` is the reply's,
 * or one entry of a batch's reply, and `status` and `statusText` the reply's.
 */
export function dataOf(
	body: unknown,
	status: number,
	statusText = '',
): unknown {
	const record = isRecord(body) ? body : undefined;
	const errors = record?.['errors'];
	if (Array.isArray(errors) && errors.length > 0) {
		throw new ApiError(
			errors as ApiErrorEntry[],
			record?.['data'] ?? undefined,
			status,
		);
	}
	if (!isSuccess(status))
		throw new ApiStatusError(status, body, { statusText });
	const data = record?.['data'];
	if (data == null) throw new ApiUnavailableError('invalid-response');
	return data;
}

/**
 * What a whole reply stands for when it is not the answer expected, such as
 * a batch's reply that is not an array of its length: its own error, else an
 * invalid response.
 */
export function replyError(reply: AnyReply): unknown {
	try {
		dataOf(reply.data, reply.status, statusTextOf(reply));
	} catch (error) {
		return error;
	}
	return new ApiUnavailableError('invalid-response');
}

/**
 * The reason phrase of the `Response` an httpyz reply was read from; `''`
 * when it has none. Read by shape: an application's own httpyz copy, passed
 * as `http`, may be another version.
 */
export function statusTextOf(reply: AnyReply): string {
	const response: unknown = (reply as { response?: unknown }).response;
	if (typeof response !== 'object' || response === null) return '';
	const { statusText } = response as { statusText?: unknown };
	return typeof statusText === 'string' ? statusText : '';
}

// Temporary, until nxgt-http#131: httpyz exports no SSE parser, so an error
// status's event stream is kept here as its raw text, never parsed.
/**
 * What a reply refusing a stream stands for, its body read by its media type:
 * its GraphQL errors as an `ApiError`, else an `ApiStatusError`.
 */
export async function refusedError(response: Response): Promise<unknown> {
	let body: unknown;
	try {
		body = await bodyOfReply(response);
	} catch (error) {
		return new ApiStatusError(response.status, undefined, {
			cause: error,
			statusText: response.statusText,
		});
	}
	try {
		dataOf(body, response.status, response.statusText);
	} catch (error) {
		return error;
	}
	return new ApiStatusError(response.status, body, {
		statusText: response.statusText,
	});
}

/** JSON when labelled so, else text; nothing for an empty body. */
async function bodyOfReply(response: Response): Promise<unknown> {
	const text = await response.text();
	if (text === '') return undefined;
	const type = response.headers.get('content-type') ?? '';
	return /[/+]json\b/i.test(type) ? JSON.parse(text) : text;
}

/**
 * What the transport threw, as this package's errors; anything else as it is.
 * httpyz's errors are recognised by `name`, never `instanceof`: an
 * application may pass its own httpyz copy as `http`, whose classes are not
 * this package's.
 */
export function transportError(error: unknown): unknown {
	if (isBodyTimeout(error) || isHttpyzError(error, 'TimeoutError'))
		return new ApiUnavailableError('timeout', { cause: error });
	if (isHttpyzError(error, 'NetworkError'))
		return new ApiUnavailableError('unreachable', { cause: error });
	// A reply labelled JSON that does not parse: a gateway's HTML page, a cut body.
	if (isHttpyzError(error, 'ValidationError')) {
		const failure = error['failure'];
		if (isRecord(failure) && failure['kind'] === 'response') {
			const status = failure['status'];
			if (typeof status === 'number' && !isSuccess(status))
				return new ApiStatusError(status, undefined, { cause: error });
			return new ApiUnavailableError('invalid-response', { cause: error });
		}
	}
	return error;
}

/**
 * One of httpyz's errors, from whichever copy of httpyz threw it: an `Error`
 * of that `name` that carries the fields httpyz's `ClientError` always has
 * (`method`, `path`, and `timeout` for a `TimeoutError`). The caller checks
 * the rest of the fields it reads.
 */
export function isHttpyzError(
	error: unknown,
	name:
		| 'TimeoutError'
		| 'NetworkError'
		| 'ValidationError'
		| 'UndeclaredStatusError',
): error is Error & Record<string, unknown> {
	if (
		!(error instanceof Error) ||
		error.name !== name ||
		error instanceof DOMException
	) {
		return false;
	}
	const fields = error as Error & Record<string, unknown>;
	return (
		typeof fields['method'] === 'string' &&
		typeof fields['path'] === 'string' &&
		(name !== 'TimeoutError' || typeof fields['timeout'] === 'number')
	);
}

/**
 * The deadline firing while the body is read: httpyz rejects with the
 * signal's own `DOMException`, not its `TimeoutError`.
 * Temporary, until nxgt-http#130: httpyz rejects a body-read deadline with
 * the signal's DOMException.
 */
function isBodyTimeout(error: unknown): boolean {
	return error instanceof DOMException && error.name === 'TimeoutError';
}

function isSuccess(status: number): boolean {
	return status >= 200 && status < 300;
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null && !Array.isArray(value);
}
