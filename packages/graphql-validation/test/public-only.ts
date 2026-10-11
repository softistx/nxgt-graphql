import type { z } from 'zod';
import type { StringSchema } from '../src/formats/format';

/**
 * `schema` reached through its public API only: the definition, `safeParse`,
 * `safeParseAsync` and `refine` are there, `_zod.run` is `run` (absent, or
 * throwing when called). What it proves: nothing of `withValidation` reads
 * zod's internal parse from the schema it is handed. The parse itself is
 * still zod's own, behind the methods.
 */
export function publicOnly<S extends StringSchema>(
	schema: S,
	run?: () => never,
): S {
	const wrapped: Record<string, unknown> = {
		_zod: { def: schema._zod.def, ...(run && { run }) },
		safeParse: (value: unknown) => schema.safeParse(value),
		safeParseAsync: (value: unknown) => schema.safeParseAsync(value),
		refine: (...args: unknown[]) =>
			publicOnly(
				(schema.refine as (...args: unknown[]) => S).apply(schema, args),
				run,
			),
	};
	return wrapped as unknown as S;
}

type Run = (payload: z.core.ParsePayload, ctx: unknown) => unknown;

/**
 * `schema` with its internal parse changed as a later zod might change it:
 * its `_zod.run`, and that of every schema its `refine` derives, returns
 * issues with no `continue`, the field zod reads to tell an abort. Zod's own
 * checks ran before, so the public results stay right; a reader of raw
 * issues would no longer see the abort.
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
	const refine = schema.refine.bind(schema) as (...args: unknown[]) => S;
	Object.assign(schema, {
		refine: (...args: unknown[]) => withoutContinue(refine(...args)),
	});
	return schema;
}
