import { describe, expect, mock, spyOn, test } from 'bun:test';
import type { TypedDocumentNode } from '@graphql-typed-document-node/core';
import { parse } from 'graphql';
import type { GraphQLCache } from './cache/types';
import { logError, writeToCache } from './report';

const Viewer = parse('{ viewer { id } }') as TypedDocumentNode<unknown, never>;

/** A cache whose write always throws `failure`. */
function failing(failure: Error, onError?: (error: unknown) => void) {
	return {
		onError,
		write: () => {
			throw failure;
		},
	} as unknown as GraphQLCache;
}

describe('writeToCache', () => {
	test("a write that throws goes to the cache's onError, never to the caller", () => {
		const failure = new Error('no isbn');
		const onError = mock();
		expect(() =>
			writeToCache(failing(failure, onError), Viewer, {}, {}),
		).not.toThrow();
		expect(onError).toHaveBeenCalledWith(failure);
	});

	test('a cache with no onError: logged with console.error', () => {
		const logged = spyOn(console, 'error').mockImplementation(() => {});
		try {
			const failure = new Error('no isbn');
			writeToCache(failing(failure), Viewer, {}, {});
			expect(logged).toHaveBeenCalledWith(failure);
		} finally {
			logged.mockRestore();
		}
	});
});

describe('logError', () => {
	test('logs with console.error and never throws', () => {
		const logged = spyOn(console, 'error').mockImplementation(() => {});
		try {
			const failure = new Error('boom');
			expect(() => logError(failure)).not.toThrow();
			expect(logged).toHaveBeenCalledWith(failure);
		} finally {
			logged.mockRestore();
		}
	});
});
