/**
 * A DOM for the React specs only: happy-dom registered while one of them
 * runs, so every other spec keeps the bare runtime. Import it first, before
 * `react-dom` or `@testing-library/react` (they read `window` as they
 * load), then call `useDom()` at the spec's top level.
 *
 * The runtime keeps its own fetch, streams, signals and timers: the client
 * under test is the one an application runs, over Bun's `Request` and
 * `AbortSignal`, and a spec asserts on the signal its fetch was given.
 */
import { afterAll, afterEach, beforeAll } from 'bun:test';
import { GlobalRegistrator } from '@happy-dom/global-registrator';

const kept = [
	'fetch',
	'Request',
	'Response',
	'Headers',
	'AbortController',
	'AbortSignal',
	'DOMException',
	'ReadableStream',
	'WritableStream',
	'TransformStream',
	'TextEncoder',
	'TextDecoder',
	'Blob',
	'File',
	'FormData',
	'URL',
	'URLSearchParams',
	'structuredClone',
	'setTimeout',
	'clearTimeout',
	'setInterval',
	'clearInterval',
	'queueMicrotask',
] as const;

function register(): void {
	if (GlobalRegistrator.isRegistered) return;
	const runtime = kept.map(
		(key) => [key, Object.getOwnPropertyDescriptor(globalThis, key)] as const,
	);
	GlobalRegistrator.register({ url: 'http://localhost/' });
	for (const [key, descriptor] of runtime)
		if (descriptor) Object.defineProperty(globalThis, key, descriptor);
	Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
}

register();

/** Registers the DOM for this spec file, and removes it after. */
export function useDom(cleanup: () => void): void {
	beforeAll(register);
	afterEach(cleanup);
	afterAll(async () => {
		cleanup();
		if (GlobalRegistrator.isRegistered) await GlobalRegistrator.unregister();
	});
}
