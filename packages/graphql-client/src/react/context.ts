import {
	createContext,
	createElement,
	type ReactNode,
	useContext,
} from 'react';
import type { GraphQLClient } from '../options';

export const noProvider =
	'No GraphQL client: render this component inside <GraphQLProvider client={client}>';

const ClientContext = createContext<GraphQLClient | undefined>(undefined);

export interface GraphQLProviderProps {
	/** The client every hook below uses: `createGraphQLClient(…)`. */
	readonly client: GraphQLClient;
	readonly children?: ReactNode;
}

/** Gives the components below it a client, for `useClient` and every hook. */
export function GraphQLProvider({
	client,
	children,
}: GraphQLProviderProps): ReactNode {
	return createElement(ClientContext, { value: client }, children);
}

/** The client of the nearest `GraphQLProvider`; throws outside one. */
export function useClient(): GraphQLClient {
	const client = useContext(ClientContext);
	if (!client) throw new Error(noProvider);
	return client;
}
