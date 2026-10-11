/**
 * The runtime's refusal of an iterator, for the operation `name`: shared by
 * the specs that hold it (msw.spec.ts asserts it whole, options.spec.ts
 * checks that docs/troubleshooting.md lists it), so they cannot drift.
 */
export function iteratorMessage(name: string): string {
	return `@nxgt/graphql-codegen-msw: the resolver of ${name} returned an iterator (a generator function?). Each request's variables are checked before the resolver runs, which msw cannot do once it keeps an iterator: answer each request from a plain function, or register one handler per answer with { once: true }.`;
}
