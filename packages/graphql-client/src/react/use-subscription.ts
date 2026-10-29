import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { GraphQLDocument } from '../document';
import { ApiError, ApiStatusError } from '../errors';
import type { GraphQLClient, Subscription, VariablesArgs } from '../options';
import { useClient } from './context';
import { headersKey, useStable, variablesKey } from './stable';

export interface UseSubscriptionOptions<TResult> {
	/** Connects nothing while `true`. Default: `false`. */
	readonly skip?: boolean;
	/** Over the client's headers, for this subscription. Compared by value. */
	readonly headers?: HeadersInit;
	/** Called with each result, before the component renders it. */
	readonly onData?: (data: TResult) => void;
	/**
	 * Called once the server accepted the stream, before any result, so a
	 * quiet stream is known to be open. The latest function is called: a new
	 * one does not reconnect.
	 */
	readonly onOpen?: () => void;
	/**
	 * Called when the stream ended cleanly (`complete`, or the server closed
	 * it), not for an error or an unmount, so a bounded stream is known to be
	 * over. The latest function is called: a new one does not reconnect.
	 */
	readonly onComplete?: () => void;
	/**
	 * Called with what ended the subscription when it failed, never for an
	 * abort. The latest function is called: a new one does not reconnect.
	 */
	readonly onError?: (error: unknown) => void;
	/**
	 * Called, after `onError`, when the failure is an unauthenticated one: an
	 * `ApiStatusError` or an `ApiError` whose `status` is 401, or whose first
	 * error's `extensions.code` is `UNAUTHENTICATED`. Refresh the credentials,
	 * then call `restart()`.
	 */
	readonly onUnauthenticated?: (error: ApiError | ApiStatusError) => void;
}

export interface SubscriptionState<TResult> {
	/** The last result. */
	readonly data: TResult | undefined;
	/** What ended the subscription, when it failed. Never an abort. */
	readonly error: unknown;
	/** The subscription is open, or connecting. */
	readonly active: boolean;
	/**
	 * Closes the subscription, if open, and opens a new one with the same
	 * document, variables and headers; `data` and `error` are cleared. Stable
	 * between renders. Nothing happens while `skip` is `true`.
	 */
	readonly restart: () => void;
}

interface Connection {
	readonly client: GraphQLClient;
	readonly document: GraphQLDocument<unknown, never>;
	readonly variables: unknown;
	readonly headers: HeadersInit | undefined;
	readonly skip: boolean;
	/** Bumped by `restart()`, so the connection is a new one. */
	readonly attempt: number;
}

interface Callbacks {
	readonly onData?: (data: unknown) => void;
	readonly onOpen?: () => void;
	readonly onComplete?: () => void;
	readonly onError?: (error: unknown) => void;
	readonly onUnauthenticated?: (error: ApiError | ApiStatusError) => void;
}

type Recorded = Omit<SubscriptionState<unknown>, 'restart'> & {
	readonly connection: Connection | undefined;
};

/**
 * Subscribes from an effect, never during a render, and closes the
 * subscription on unmount and whenever its variables change by value.
 */
export function useSubscription<TResult, TVariables>(
	document: GraphQLDocument<TResult, TVariables>,
	...[raw, options = {}]: VariablesArgs<
		NoInfer<TVariables>,
		UseSubscriptionOptions<NoInfer<TResult>>
	>
): SubscriptionState<TResult> {
	const client = useClient();
	const { skip = false, onData, onOpen, onComplete, onError } = options;
	const { onUnauthenticated } = options;
	const [attempt, setAttempt] = useState(0);
	const restart = useCallback(() => setAttempt((n) => n + 1), []);
	const variables = useStable(raw, variablesKey(raw));
	const headers = useStable(options.headers, headersKey(options.headers));
	const connection = useMemo<Connection>(
		() => ({
			client,
			document: document as GraphQLDocument<unknown, never>,
			variables,
			headers,
			skip,
			attempt,
		}),
		[client, document, variables, headers, skip, attempt],
	);
	const latest = useRef<Callbacks>({});
	useEffect(() => {
		latest.current = {
			onData,
			onOpen,
			onComplete,
			onError,
			onUnauthenticated,
		} as Callbacks;
	});
	const [recorded, setRecorded] = useState<Recorded>(() => initial(undefined));
	useEffect(
		() =>
			listen(
				connection,
				{
					onData: (data) => latest.current.onData?.(data),
					onOpen: () => latest.current.onOpen?.(),
					onComplete: () => latest.current.onComplete?.(),
					onError: (error) => {
						latest.current.onError?.(error);
						if (isUnauthenticated(error))
							latest.current.onUnauthenticated?.(error);
					},
				},
				setRecorded,
			),
		[connection],
	);
	const shown =
		recorded.connection === connection ? recorded : initial(connection);
	const { data, error, active } = shown;
	return { data: data as TResult | undefined, error, active, restart };
}

function isUnauthenticated(error: unknown): error is ApiError | ApiStatusError {
	if (error instanceof ApiStatusError) return error.status === 401;
	return (
		error instanceof ApiError &&
		(error.status === 401 || error.code === 'UNAUTHENTICATED')
	);
}

function initial(connection: Connection | undefined): Recorded {
	return {
		connection,
		data: undefined,
		error: undefined,
		active: connection !== undefined && !connection.skip,
	};
}

/** Reads the subscription until it ends; the cleanup closes it. */
function listen(
	connection: Connection,
	callbacks: Required<Omit<Callbacks, 'onUnauthenticated'>>,
	record: (state: Recorded) => void,
): () => void {
	if (connection.skip) return () => {};
	const { client, document, variables, headers } = connection;
	const controller = new AbortController();
	const { signal } = controller;
	let subscription: Subscription<unknown>;
	try {
		subscription = client.subscribe(document, variables as never, {
			signal,
			onOpen: callbacks.onOpen,
			...(headers !== undefined && { headers }),
		});
	} catch (error) {
		// A query given to subscribe(), a document with no persisted hash.
		record({ connection, data: undefined, error, active: false });
		callbacks.onError(error);
		return () => {};
	}
	let last: unknown;
	const loop = async () => {
		try {
			for await (const data of subscription) {
				if (signal.aborted) return;
				last = data;
				callbacks.onData(data);
				record({ connection, data, error: undefined, active: true });
			}
			if (!signal.aborted) {
				record({ connection, data: last, error: undefined, active: false });
				callbacks.onComplete();
			}
		} catch (error) {
			if (!signal.aborted) {
				record({ connection, data: last, error, active: false });
				callbacks.onError(error);
			}
		}
	};
	loop();
	return () => {
		controller.abort();
		subscription.close();
	};
}
