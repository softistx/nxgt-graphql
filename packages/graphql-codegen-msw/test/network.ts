// msw's network for the specs under Bun: the very handlers and frames
// `setupServer` runs, fed by the web fetch interceptor, which patches the
// global `fetch` only. msw/node's `setupServer` intercepts no request under
// Bun (msw 3.0.3, Bun 1.4.2): its fetch interceptor works through Node's
// sockets, which Bun's fetch does not use. `setup-server.spec.ts` runs
// `setupServer` itself under Node.
import { FetchInterceptor } from '@mswjs/interceptors/fetch/web';
import type { AnyHandler } from 'msw';
import { defineNetwork, InterceptorSource } from 'msw/experimental';

/** A network with `setupServer`'s calls: listen, use, resetHandlers, close. */
export function setupFetchNetwork() {
	const network = defineNetwork({
		sources: [new InterceptorSource({ interceptors: [fetchInterceptor()] })],
		handlers: [],
		onUnhandledFrame: 'error',
		context: { quiet: true },
	});
	return {
		listen: () => network.enable(),
		use: (...handlers: AnyHandler[]) => network.use(...handlers),
		resetHandlers: () => network.resetHandlers(),
		close: () => network.disable(),
	};
}

type Interceptors = ConstructorParameters<
	typeof InterceptorSource
>[0]['interceptors'];

/**
 * The web fetch interceptor, typed as msw's node build expects: the
 * interceptors package declares its base class once per build (browser,
 * node), so the two types differ though the class is one.
 */
function fetchInterceptor(): Interceptors[number] {
	return new FetchInterceptor() as unknown as Interceptors[number];
}
