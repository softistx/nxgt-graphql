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

/** A response's `data`, or the error it stands for. */
export function dataOf(reply: AnyReply): unknown {
	const body = isRecord(reply.data) ? reply.data : undefined;
	const errors = body?.['errors'];
	if (Array.isArray(errors) && errors.length > 0) {
		throw new ApiError(
			errors as ApiErrorEntry[],
			body?.['data'] ?? undefined,
			reply.status,
		);
	}
	if (!isSuccess(reply.status))
		throw new ApiStatusError(reply.status, reply.data);
	const data = body?.['data'];
	if (data == null) throw new ApiUnavailableError('invalid-response');
	return data;
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
			return new ApiStatusError(status, undefined);
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
