import { z } from 'zod';
import { RULE_PARAM } from '../rules/rule';
import type { StringSchema } from './format';

/**
 * The application's schema as a plain string schema the rules can narrow,
 * each of its issues re-raised as it was (code, message, and an abort that
 * stops the rules chained after it) and marked as the format's: a
 * `.regex()` inside it is the format's refusal, not `pattern`'s.
 * The value is checked, never changed: a schema that still returns another
 * value (a custom `.check()` setting `payload.value`, which `rewrites`
 * cannot see) throws, naming the format, as a resolver's bug would.
 *
 * Only zod's public API runs the schema, whatever zod 4 copy it comes from:
 * `safeParse`, `safeParseAsync`, `superRefine` and the issues they return,
 * so a zod release that changes its internals changes nothing here.
 *
 * - **An abort** is read from a check of our own chained last on the schema
 *   (`superRefine`): zod runs it unless an earlier check aborted, so a
 *   refusal that never reached it aborted, and its issues are re-raised
 *   with `continue: false`, stopping the rules after the format as they
 *   stop in the generated client.
 * - **An async check** is run by `safeParseAsync`, once, when the schema is
 *   known to be async: `async` says so from its definition (an `async`
 *   function in a `.refine()`), or the format learnt it from a value. A
 *   format not known to be async runs `safeParse` first; when that throws
 *   (zod's async error, or anything else) it runs again with
 *   `safeParseAsync`, as zod's own Standard Schema `validate` does: for that
 *   value the check runs twice, and the promise the synchronous attempt
 *   dropped is zod's, out of our reach. The format is then known to be
 *   async, so this happens once per process.
 *
 * The promise returned to the enclosing parse gets a handler, so a
 * synchronous parse (a default value's check) that throws zod's async error
 * and drops it leaves no unhandled rejection; `onAsync` is told before it is
 * returned.
 */
export function marked(
	name: string,
	schema: StringSchema,
	options: { async: boolean; onAsync: () => void },
): StringSchema {
	let async = options.async;
	let reached = false;
	// Zod runs a refinement unless an earlier check aborted: a failed parse
	// that did not reach this one aborted.
	const probe = schema.superRefine(() => {
		reached = true;
	});

	const raise = (
		value: string,
		ctx: z.core.$RefinementCtx<string>,
		result: z.ZodSafeParseResult<unknown>,
		aborted: boolean,
	) => {
		if (result.success) {
			if (result.data !== value) {
				throw new Error(
					`The format "${name}" rewrote the value it checked: a format checks the value and never changes it, so the server and the client check the value as it was sent. Refuse what is not canonical with .regex() or .refine() instead of setting payload.value in a .check().`,
				);
			}
			return;
		}
		for (const issue of result.error.issues) {
			const params = 'params' in issue ? issue.params : undefined;
			ctx.addIssue({
				...issue,
				params: { ...params, [RULE_PARAM]: 'format' },
				...(aborted && { continue: false }),
			} as Parameters<typeof ctx.addIssue>[0]);
		}
	};

	// Once async, zod has already run the rules chained after the format
	// when its issues arrive: an abort then stops nothing, on the server only.
	const later = (
		value: string,
		ctx: z.core.$RefinementCtx<string>,
		learn: boolean,
	) => {
		const pending = schema.safeParseAsync(value).then((result) => {
			if (learn) async = true;
			raise(value, ctx, result, false);
		});
		pending.catch(() => {});
		options.onAsync();
		return pending;
	};

	return z.string().superRefine((value, ctx) => {
		if (async) return later(value, ctx, false);
		let result: z.ZodSafeParseResult<unknown>;
		reached = false;
		try {
			result = probe.safeParse(value);
		} catch (error) {
			// zod's async error, from any copy: async from now on. Anything
			// else may be one a later zod renamed, or the check's own throw:
			// the async run tells, and rethrows the latter.
			const known = isAsyncError(error);
			if (known) async = true;
			return later(value, ctx, !known);
		}
		raise(value, ctx, result, !result.success && !reached);
		return undefined;
	});
}

/** zod's `$ZodAsyncError`, from this copy of zod or another one. */
function isAsyncError(error: unknown): boolean {
	return (
		error instanceof z.core.$ZodAsyncError ||
		(error as { constructor?: { name?: unknown } } | null)?.constructor
			?.name === '$ZodAsyncError'
	);
}
