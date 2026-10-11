import type { Operation } from './document';
import { isApiError } from './errors';

/**
 * How an operation is named to the server: by its text (`false`), by the
 * hash the client preset wrote (`documentId`), or by its text's SHA-256,
 * registered on first use (`apq`).
 */
export type PersistedQueries = false | { mode: 'documentId' } | { mode: 'apq' };

/** What is posted for one operation. */
export interface OperationBody {
	readonly query?: string;
	readonly documentId?: string;
	readonly variables: unknown;
	readonly operationName: string | undefined;
	readonly extensions?: {
		readonly persistedQuery: {
			readonly version: 1;
			readonly sha256Hash: string;
		};
	};
}

export const missingHash =
	'The document carries no persisted hash: enable persistedDocuments in the client preset';

/** Refuses, before anything is sent, an operation `documentId` cannot name. */
export function checkPersistable(
	operation: Operation,
	persisted: PersistedQueries,
): void {
	if (modeOf(persisted) === 'documentId' && !operation.hash)
		throw new TypeError(missingHash);
}

/** The body for an operation, its text left out when the server holds it. */
export async function bodyOf(
	operation: Operation,
	variables: unknown,
	persisted: PersistedQueries,
): Promise<OperationBody> {
	const named = {
		variables: variables ?? {},
		operationName: operation.operationName,
	};
	if (!persisted) return { query: operation.query, ...named };
	if (persisted.mode === 'documentId') {
		checkPersistable(operation, persisted);
		return { documentId: operation.hash as string, ...named };
	}
	const sha256Hash = await sha256Of(operation);
	return {
		...named,
		extensions: { persistedQuery: { version: 1, sha256Hash } },
	};
}

/** The same body with the text added: APQ's registration. */
export function withQuery(
	operation: Operation,
	body: OperationBody,
): OperationBody {
	return { query: operation.query, ...body };
}

/**
 * The server does not hold the hash it was sent yet: nothing was executed.
 * A reply that carried data ran, so it is never answered again.
 */
export function isPersistedQueryNotFound(
	persisted: PersistedQueries,
	error: unknown,
): boolean {
	if (modeOf(persisted) !== 'apq' || !isApiError(error)) return false;
	if (error.data !== undefined) return false;
	const [first] = error.errors;
	return (
		first?.extensions?.code === 'PERSISTED_QUERY_NOT_FOUND' ||
		first?.message === 'PersistedQueryNotFound'
	);
}

function modeOf(persisted: PersistedQueries) {
	return persisted ? persisted.mode : undefined;
}

const hashes = new WeakMap<Operation, Promise<string>>();

/** The SHA-256 of the exact text sent, in hex: computed once per operation. */
export function sha256Of(operation: Operation): Promise<string> {
	let hash = hashes.get(operation);
	if (!hash) {
		hash = sha256Hex(operation.query);
		hashes.set(operation, hash);
	}
	return hash;
}

export async function sha256Hex(text: string): Promise<string> {
	const subtle = globalThis.crypto?.subtle;
	if (!subtle)
		throw new TypeError(
			'APQ needs crypto.subtle: serve the page over https or localhost',
		);
	const digest = await subtle.digest('SHA-256', new TextEncoder().encode(text));
	return Array.from(new Uint8Array(digest), (byte) =>
		byte.toString(16).padStart(2, '0'),
	).join('');
}
