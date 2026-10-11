import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { GraphQLDocument } from '../document';
import type { CallOptions, VariablesArgs } from '../options';
import { useClient } from './context';

/** Runs the mutation: resolves with its data, rejects as `client.mutate` does. */
export type MutateFunction<TResult, TVariables> = (
	...args: VariablesArgs<TVariables, CallOptions>
) => Promise<TResult>;

export interface MutationState<TResult> {
	/** The last call's data. */
	readonly data: TResult | undefined;
	/** What the last call rejected with. */
	readonly error: unknown;
	/** The last call is in flight. */
	readonly loading: boolean;
	/** Back to the state before any call; a call in flight then records nothing. */
	readonly reset: () => void;
}

type Recorded = Omit<MutationState<unknown>, 'reset'>;

const idle: Recorded = { data: undefined, error: undefined, loading: false };

/**
 * A mutation and the state of its last call. `mutate` returns the call's
 * promise and records how it settled; after an unmount, or once a newer call
 * or `reset` came, it records nothing.
 */
export function useMutation<TResult, TVariables>(
	document: GraphQLDocument<TResult, TVariables>,
): [MutateFunction<TResult, NoInfer<TVariables>>, MutationState<TResult>] {
	const client = useClient();
	const [recorded, setRecorded] = useState(idle);
	const calls = useRef(0);
	const mounted = useRef(false);
	useEffect(() => {
		mounted.current = true;
		return () => {
			mounted.current = false;
		};
	}, []);
	const mutate = useCallback(
		async (variables?: unknown, options?: CallOptions) => {
			const call = ++calls.current;
			const record = (next: Recorded) => {
				if (mounted.current && call === calls.current) setRecorded(next);
			};
			record({ data: undefined, error: undefined, loading: true });
			try {
				const data = await client.mutate(
					document as GraphQLDocument<unknown, never>,
					variables as never,
					options,
				);
				record({ data, error: undefined, loading: false });
				return data;
			} catch (error) {
				record({ data: undefined, error, loading: false });
				throw error;
			}
		},
		[client, document],
	);
	const reset = useCallback(() => {
		calls.current++;
		setRecorded(idle);
	}, []);
	const state = useMemo(() => ({ ...recorded, reset }), [recorded, reset]);
	return [
		mutate as MutateFunction<TResult, NoInfer<TVariables>>,
		state as MutationState<TResult>,
	];
}
