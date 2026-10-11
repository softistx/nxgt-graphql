import { describe, expect, test } from 'bun:test';
import { Party } from './share';

describe('Party', () => {
	test('a caller without a signal gets the result', async () => {
		const party = new Party();
		expect(await party.join(Promise.resolve('ok'), undefined)).toBe('ok');
	});

	test("a caller's abort rejects it alone; the last one aborts the request and runs onEmpty", async () => {
		let emptied = 0;
		const party = new Party(() => emptied++);
		const never = new Promise<string>(() => {});
		const first = new AbortController();
		const second = new AbortController();
		const a = party.join(never, first.signal).catch((e: unknown) => e);
		const b = party.join(never, second.signal).catch((e: unknown) => e);
		const reason = new Error('first left');
		first.abort(reason);
		expect(await a).toBe(reason);
		expect(party.signal.aborted).toBe(false);
		expect(emptied).toBe(0);
		second.abort();
		await b;
		expect(party.signal.aborted).toBe(true);
		expect(emptied).toBe(1);
	});

	test('a caller without a signal never leaves', async () => {
		const party = new Party();
		const never = new Promise<string>(() => {});
		const controller = new AbortController();
		party.join(never, undefined);
		const left = party.join(never, controller.signal).catch(() => 'left');
		controller.abort();
		expect(await left).toBe('left');
		expect(party.signal.aborted).toBe(false);
	});

	test('a settled caller no longer listens to its signal', async () => {
		const party = new Party();
		const controller = new AbortController();
		expect(
			await party
				.join(Promise.reject(new Error('x')), controller.signal)
				.catch((e: Error) => e.message),
		).toBe('x');
		controller.abort();
		expect(party.signal.aborted).toBe(false);
	});
});
