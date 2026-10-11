import {
	type AnyReply,
	NetworkError,
	TimeoutError,
	ValidationError,
} from '@nxgt/httpyz';
import {
	ApiError,
	type ApiErrorEntry,
	ApiStatusError,
	ApiUnavailableError,
} from './errors';

/**
 * A response's `data`, or the error it stands for: `body` is the reply's,
 * or one entry of a batch's reply, and `status` the reply's HTTP status.
 */
export function dataOf(body: unknown, status: number): unknown {
	const record = isRecord(body) ? body : undefined;
	const errors = record?.['errors'];
	if (Array.isArray(errors) && errors.length > 0) {
		throw new ApiError(
			errors as ApiErrorEntry[],
			record?.['data'] ?? undefined,
			status,
		);
	}
	if (!isSuccess(status)) throw new ApiStatusError(status, body);
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
		dataOf(reply.data, reply.status);
	} catch (error) {
		return error;
	}
	return new ApiUnavailableError('invalid-response');
}

/**
 * What a reply refusing a stream stands for, its body read by its media type:
 * its GraphQL errors as an `ApiError`, else an `ApiStatusError`.
 */
export async function refusedError(response: Response): Promise<unknown> {
	let body: unknown;
	try {
		body = await bodyOfReply(response);
	} catch (error) {
		return new ApiStatusError(response.status, undefined, { cause: error });
	}
	try {
		dataOf(body, response.status);
	} catch (error) {
		return error;
	}
	return new ApiStatusError(response.status, body);
}

/** JSON when labelled so, else text; nothing for an empty body. */
async function bodyOfReply(response: Response): Promise<unknown> {
	const text = await response.text();
	if (text === '') return undefined;
	const type = response.headers.get('content-type') ?? '';
	return /[/+]json\b/i.test(type) ? JSON.parse(text) : text;
}

/** What the transport threw, as this package's errors; anything else as it is. */
export function transportError(error: unknown): unknown {
	if (error instanceof TimeoutError || isBodyTimeout(error))
		return new ApiUnavailableError('timeout', { cause: error });
	if (error instanceof NetworkError)
		return new ApiUnavailableError('unreachable', { cause: error });
	// A reply labelled JSON that does not parse: a gateway's HTML page, a cut body.
	if (error instanceof ValidationError && error.failure.kind === 'response') {
		const { status } = error.failure;
		if (status !== undefined && !isSuccess(status))
			return new ApiStatusError(status, undefined, { cause: error });
		return new ApiUnavailableError('invalid-response', { cause: error });
	}
	return error;
}

/**
 * The deadline firing while the body is read: httpyz rejects with the
 * signal's own `DOMException`, not its `TimeoutError`.
 * Temporary, until nxgt-http wraps body reads (issue requested).
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
