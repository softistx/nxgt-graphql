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
 * `safeParse`, `safeParseAsync`, `refine` (with `when`), `check` pushing to
 * `ctx.issues`, and the issues `safeParse` returns, so a zod release that
 * changes its internals changes nothing here.
 *
 * - **An abort** is read from two refinements of our own chained last on the
 *   schema. Zod skips a plain one after any issue that does not continue
 *   (`abort: true`, or an issue a `.check()` pushed with no `continue`), and
 *   one with a `when` only after an explicit abort (`continue: false`), which
 *   also stops the length checks (`.max()`, …). Which of the two ran says
 *   which abort it was, and the issues are re-raised with that same
 *   `continue`, so the rules after the format stop as they stop when chained
 *   on the schema itself, in the generated client.
 * - **An async check** is run by `safeParseAsync`, once, when the schema is
 *   known to be async: `async` says so from its definition (an `async`
 *   function in a `.refine()`), or the format learnt it from a value. A
 *   format not known to be async runs `safeParse` first; when that throws
 *   zod's async error (`$ZodAsyncError`, a public export, matched by class or
 *   by name across copies) it runs again with `safeParseAsync`, as zod's own
 *   Standard Schema `validate` does: for that value the check runs twice, and
 *   the promise the synchronous attempt dropped is zod's, out of our reach.
 *   The format is then known to be async, so this happens once per format.
 *   Any other error is the check's own, and is thrown as it is.
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
	let continued = false;
	let notStopped = false;
	const probe = schema
		.refine(() => {
			continued = true;
			return true;
		})
		.refine(
			() => {
				notStopped = true;
				return true;
			},
			{ when: () => true },
		);

	const raise = (
		ctx: z.core.ParsePayload<string>,
		result: z.ZodSafeParseResult<unknown>,
		next: boolean | undefined,
	) => {
		if (result.success) {
			if (result.data !== ctx.value) {
				throw new Error(
					`The format "${name}" rewrote the value it checked: a format checks the value and never changes it, so the server and the client check the value as it was sent. Refuse what is not canonical with .regex() or .refine() instead of setting payload.value in a .check().`,
				);
			}
			return;
		}
		for (const issue of result.error.issues) {
			const params = 'params' in issue ? issue.params : undefined;
			ctx.issues.push({
				...issue,
				input: ctx.value,
				params: { ...params, [RULE_PARAM]: 'format' },
				...(next !== undefined && { continue: next }),
			} as z.core.$ZodRawIssue);
		}
	};

	// Once async, zod has already run the rules chained after the format
	// when its issues arrive: an abort then stops nothing, on the server only.
	const later = (ctx: z.core.ParsePayload<string>) => {
		const pending = schema
			.safeParseAsync(ctx.value)
			.then((result) => raise(ctx, result, true));
		pending.catch(() => {});
		options.onAsync();
		return pending;
	};

	return z.string().check((ctx) => {
		if (async) return later(ctx);
		let result: z.ZodSafeParseResult<unknown>;
		continued = notStopped = false;
		try {
			result = probe.safeParse(ctx.value);
		} catch (error) {
			if (!isAsyncError(error)) throw error;
			async = true;
			return later(ctx);
		}
		// Both ran: every issue continues. Only the `when` one: an issue that
		// does not continue. Neither: an explicit abort.
		raise(ctx, result, continued ? true : notStopped ? undefined : false);
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
