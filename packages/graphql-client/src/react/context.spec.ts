import '../../test/dom';
import { describe, expect, test } from 'bun:test';
import { cleanup, renderHook } from '@testing-library/react/pure';
import { useDom } from '../../test/dom';
import { BookQuery, url, withClient } from '../../test/react';
import { createGraphQLClient } from '../client';
import { noProvider, useClient } from './context';
import { useQuery } from './use-query';

useDom(cleanup);

/** React logs what a render threw before rethrowing it; the spec only reads the throw. */
function quietly(run: () => void): void {
	const consoleError = console.error;
	console.error = () => {};
	try {
		run();
	} finally {
		console.error = consoleError;
	}
}

describe('GraphQLProvider and useClient', () => {
	test('useClient returns the provided client', () => {
		const client = createGraphQLClient({ url });
		const { result } = renderHook(() => useClient(), {
			wrapper: withClient(client),
		});
		expect(result.current).toBe(client);
	});

	test('useClient outside a provider throws, naming the fix', () => {
		quietly(() => {
			expect(() => renderHook(() => useClient())).toThrow(noProvider);
		});
	});

	test('every hook needs the provider', () => {
		quietly(() => {
			expect(() => renderHook(() => useQuery(BookQuery, { id: '1' }))).toThrow(
				noProvider,
			);
		});
	});
});
