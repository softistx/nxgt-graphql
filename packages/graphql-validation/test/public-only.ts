import type { z } from 'zod';
import type { StringSchema } from '../src/formats/format';

/** The methods `withValidation` calls on an application's format. */
const DERIVING = ['check', 'refine', 'catch'] as const;

/**
 * `schema` reached through its public API only: the definition,
 * `safeParseAsync`, and `check`, `refine` and `catch` (each deriving another
 * such schema) are there; `_zod.run` is `run` (absent, or throwing when
 * called). What it proves: nothing of `withValidation` reads zod's internal
 * parse from the schema it is handed. The parse itself is still zod's own,
 * behind the methods.
 */
export function publicOnly<S extends StringSchema>(
	schema: S,
	run?: () => never,
): S {
	const methods = schema as unknown as Record<
		string,
		(...args: unknown[]) => S
	>;
	const wrapped: Record<string, unknown> = {
		_zod: { def: schema._zod.def, ...(run && { run }) },
		safeParseAsync: (value: unknown) => schema.safeParseAsync(value),
	};
	for (const method of DERIVING) {
		wrapped[method] = (...args: unknown[]) =>
			publicOnly(methods[method]?.apply(schema, args) as S, run);
	}
	return wrapped as unknown as S;
}

type Run = (payload: z.core.ParsePayload, ctx: unknown) => unknown;

/**
 * `schema` with its internal parse changed as a later zod might change it:
 * its `_zod.run`, and that of every schema it derives, returns issues with
 * no `continue`, the field zod reads to tell an abort. Zod's own checks ran
 * before, so the public results stay right; a reader of raw issues would no
 * longer see the abort.
 */
export function withoutContinue<S extends StringSchema>(schema: S): S {
	const internals = schema._zod as unknown as { run: Run };
	const run = internals.run.bind(internals);
	const strip = (payload: z.core.ParsePayload) => {
		for (const issue of payload.issues)
			delete (issue as { continue?: boolean }).continue;
		return payload;
	};
	internals.run = (payload, ctx) => {
		const result = run(payload, ctx);
		return result instanceof Promise
			? result.then(strip)
			: strip(result as z.core.ParsePayload);
	};
	const methods = schema as unknown as Record<
		string,
		(...args: unknown[]) => S
	>;
	for (const method of DERIVING) {
		const derive = methods[method]?.bind(schema);
		if (derive)
			methods[method] = (...args: unknown[]) =>
				withoutContinue(derive(...args));
	}
	return schema;
}
