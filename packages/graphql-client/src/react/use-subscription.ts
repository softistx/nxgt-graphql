import { useEffect, useMemo, useRef, useState } from 'react';
import type { GraphQLDocument } from '../document';
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
}

export interface SubscriptionState<TResult> {
	/** The last result. */
	readonly data: TResult | undefined;
	/** What ended the subscription, when it failed. Never an abort. */
	readonly error: unknown;
	/** The subscription is open, or connecting. */
	readonly active: boolean;
}

interface Connection {
	readonly client: GraphQLClient;
	readonly document: GraphQLDocument<unknown, never>;
	readonly variables: unknown;
	readonly headers: HeadersInit | undefined;
	readonly skip: boolean;
}

type Recorded = SubscriptionState<unknown> & {
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
	const { skip = false, onData } = options;
	const variables = useStable(raw, variablesKey(raw));
	const headers = useStable(options.headers, headersKey(options.headers));
	const connection = useMemo<Connection>(
		() => ({
			client,
			document: document as GraphQLDocument<unknown, never>,
			variables,
			headers,
			skip,
		}),
		[client, document, variables, headers, skip],
	);
	const latest = useRef(onData as ((data: unknown) => void) | undefined);
	useEffect(() => {
		latest.current = onData as ((data: unknown) => void) | undefined;
	});
	const [recorded, setRecorded] = useState<Recorded>(() => initial(undefined));
	useEffect(
		() => listen(connection, (data) => latest.current?.(data), setRecorded),
		[connection],
	);
	const shown =
		recorded.connection === connection ? recorded : initial(connection);
	const { data, error, active } = shown;
	return { data: data as TResult | undefined, error, active };
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
	onData: (data: unknown) => void,
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
			...(headers !== undefined && { headers }),
		});
	} catch (error) {
		// A query given to subscribe(), a document with no persisted hash.
		record({ connection, data: undefined, error, active: false });
		return () => {};
	}
	let last: unknown;
	const loop = async () => {
		try {
			for await (const data of subscription) {
				if (signal.aborted) return;
				last = data;
				onData(data);
				record({ connection, data, error: undefined, active: true });
			}
			if (!signal.aborted)
				record({ connection, data: last, error: undefined, active: false });
		} catch (error) {
			if (!signal.aborted)
				record({ connection, data: last, error, active: false });
		}
	};
	loop();
	return () => {
		controller.abort();
		subscription.close();
	};
}
