import type { StringSchema } from '../src/formats/format';

/**
 * `schema` as a zod release whose internals differ would hand it: the
 * definition and the public methods are there, `_zod.run` is `run` (absent,
 * or throwing when called).
 */
export function publicOnly<S extends StringSchema>(
	schema: S,
	run?: () => never,
): S {
	const wrapped: Record<string, unknown> = {
		_zod: { def: schema._zod.def, ...(run && { run }) },
		safeParse: (value: unknown) => schema.safeParse(value),
		safeParseAsync: (value: unknown) => schema.safeParseAsync(value),
		superRefine: (check: Parameters<S['superRefine']>[0]) =>
			publicOnly(schema.superRefine(check), run),
	};
	return wrapped as unknown as S;
}
