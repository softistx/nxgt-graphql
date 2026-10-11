import { describe, expect, test } from 'bun:test';
import { operationOf } from './document';
import { callKey, dedupeKey } from './keys';

const operation = operationOf('query A { a }' as never);

describe('keys', () => {
	test('headers, timeout and retry tell calls apart', () => {
		const base = callKey({ headers: { a: '1' }, timeout: 5 }, 1);
		expect(callKey({ headers: { a: '1' }, timeout: 5 }, 1)).toBe(base);
		expect(callKey({ headers: { a: '2' }, timeout: 5 }, 1)).not.toBe(base);
		expect(callKey({ headers: { a: '1' }, timeout: 6 }, 1)).not.toBe(base);
		expect(callKey({ headers: { a: '1' }, timeout: 5 }, 2)).not.toBe(base);
	});

	test('retry.delay is not part of a key', () => {
		expect(callKey({}, { attempts: 1, delay: () => 1 })).toBe(
			callKey({}, { attempts: 1, delay: () => 2 }),
		);
	});

	test('the dedupe key adds the text and the variables', () => {
		const key = dedupeKey(operation, { id: 1 }, {}, undefined);
		expect(dedupeKey(operation, { id: 1 }, {}, undefined)).toBe(key);
		expect(dedupeKey(operation, { id: 2 }, {}, undefined)).not.toBe(key);
		expect(dedupeKey(operation, undefined, {}, undefined)).toBe(
			dedupeKey(operation, {}, {}, undefined),
		);
	});
});
