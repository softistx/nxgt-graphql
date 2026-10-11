import { describe, expect, test } from 'bun:test';
import { Deduplicator } from './dedupe';

/** A send held until `release()`, recording the signal it was given. */
function held() {
	let release!: (value: string) => void;
	const gate = new Promise<string>((resolve) => (release = resolve));
	const signals: AbortSignal[] = [];
	const send = (signal: AbortSignal) => {
		signals.push(signal);
		return gate;
	};
	return { send, release, signals };
}

describe('Deduplicator', () => {
	test('callers with the same key share one flight', async () => {
		const flights = new Deduplicator();
		const api = held();
		const a = flights.run('k', undefined, api.send);
		const b = flights.run('k', undefined, api.send);
		api.release('done');
		expect(await Promise.all([a, b])).toEqual(['done', 'done']);
		expect(api.signals).toHaveLength(1);
	});

	test('different keys are different flights', async () => {
		const flights = new Deduplicator();
		const api = held();
		const both = Promise.all([
			flights.run('a', undefined, api.send),
			flights.run('b', undefined, api.send),
		]);
		api.release('x');
		await both;
		expect(api.signals).toHaveLength(2);
	});

	test('an already-aborted signal neither joins nor starts a flight', async () => {
		const flights = new Deduplicator();
		const reason = new Error('gone');
		const aborted = AbortSignal.abort(reason);
		let calls = 0;
		const send = () => {
			calls++;
			return Promise.resolve('x');
		};
		expect(await flights.run('k', aborted, send).catch((e: unknown) => e)).toBe(
			reason,
		);
		expect(calls).toBe(0);

		const api = held();
		const live = flights.run('k', undefined, api.send);
		expect(
			await flights.run('k', aborted, api.send).catch((e: unknown) => e),
		).toBe(reason);
		api.release('ok');
		await live;
		expect(api.signals).toHaveLength(1);
	});

	test('a caller without a signal keeps the flight alive after signalled callers leave', async () => {
		const flights = new Deduplicator();
		const api = held();
		const controller = new AbortController();
		const left = flights.run('k', controller.signal, api.send);
		const stays = flights.run('k', undefined, api.send);
		const reason = new Error('left');
		controller.abort(reason);
		expect(await left.catch((e: unknown) => e)).toBe(reason);
		expect(api.signals[0]?.aborted).toBe(false);
		api.release('ok');
		expect(await stays).toBe('ok');
		expect(api.signals).toHaveLength(1);
	});

	test('when every caller left, the shared signal is aborted and the next run starts afresh', async () => {
		const flights = new Deduplicator();
		const api = held();
		const first = new AbortController();
		const second = new AbortController();
		const a = flights.run('k', first.signal, api.send).catch((e: unknown) => e);
		const b = flights
			.run('k', second.signal, api.send)
			.catch((e: unknown) => e);
		first.abort();
		expect(api.signals[0]?.aborted).toBe(false);
		second.abort();
		await Promise.all([a, b]);
		expect(api.signals[0]?.aborted).toBe(true);

		const again = flights.run('k', undefined, api.send);
		expect(api.signals).toHaveLength(2);
		expect(api.signals[1]?.aborted).toBe(false);
		api.release('ok');
		expect(await again).toBe('ok');
	});

	test('no unhandled rejection once every caller left', async () => {
		const fired: unknown[] = [];
		const onUnhandled = (reason: unknown) => fired.push(reason);
		process.on('unhandledRejection', onUnhandled);
		try {
			const flights = new Deduplicator();
			const controller = new AbortController();
			// A send that rejects with the shared signal's reason, as fetch does.
			const send = (signal: AbortSignal) =>
				new Promise<string>((_, reject) =>
					signal.addEventListener('abort', () => reject(signal.reason)),
				);
			const caller = flights
				.run('k', controller.signal, send)
				.catch((e: unknown) => e);
			controller.abort(new Error('left'));
			await caller;
			await Bun.sleep(10);
			expect(fired).toEqual([]);
		} finally {
			process.off('unhandledRejection', onUnhandled);
		}
	});
});
