import { z } from 'zod';
import { RULE_PARAM } from '../rules/rule';
import type { StringSchema } from './format';

/** The rules written after a format, applied to the schema they narrow. */
export type Narrow = (schema: StringSchema) => z.ZodType;

/** The issues of a refused run, as the value `.catch()` hands on. */
class Refused {
	constructor(readonly issues: readonly z.core.$ZodIssue[]) {}
}

/** Where our own refinements mark the issues they add. */
const SENTINEL = 'nxgtSentinel';

/**
 * The application's schema as a plain string schema, narrowed by the rules
 * written after it (`narrow`), each of its issues re-raised as it was (code,
 * message, and an abort that stops those rules) and marked as the format's:
 * a `.regex()` inside it is the format's refusal, not `pattern`'s. The value
 * is checked, never changed: a schema that still returns another value (a
 * custom `.check()` setting `payload.value`, which `rewrites` cannot see)
 * throws, naming the format, as a resolver's bug would.
 *
 * Only zod's public API runs the schema, whatever zod 4 copy it comes from:
 * `safeParseAsync`, `check` pushing to `ctx.issues`, `refine` (with
 * `when`), `catch`, and the issues they return. A zod release that changes
 * its internals changes nothing here.
 *
 * - **Once per value, never a dropped promise.** The schema runs through
 *   `safeParseAsync` only, never a synchronous `safeParse` that would start
 *   an async check and drop its promise. A `.catch()` and a `.refine()`
 *   chained last tell, as soon as the call returns, whether the run
 *   finished synchronously (zod runs a schema's checks within the call
 *   until one returns a promise): then its result is used at once, so a
 *   synchronous parse (a default value's check at startup) still works.
 *   Otherwise the promise is returned to the enclosing parse, with a
 *   handler, and `onAsync` is told: a synchronous parse throws zod's async
 *   error and `checkDefaults` names the format.
 * - **An abort** is read from two refinements chained after the schema's
 *   checks: a plain one, which zod skips after any issue that does not
 *   continue (`abort: true`, an issue a `.check()` pushed with no
 *   `continue`), and one with a `when`, skipped only after `continue:
 *   false`. Each marks a refused run's issues when it ran. The issues are
 *   then replayed, with that same `continue`, through a `z.string()`
 *   narrowed by the rules, so zod itself decides which rules run, as it does
 *   on the client where they are chained on the schema.
 * - **Once async**, zod on the client runs the rules before the async
 *   check's issues arrive, whatever its abort: the rules run here too, and
 *   the format's issues come first.
 */
export function marked(
	name: string,
	schema: StringSchema,
	onAsync: () => void,
): (narrow: Narrow) => StringSchema {
	let done = false;
	let outcome: unknown;
	const probe = schema
		.check((ctx) => {
			if (ctx.issues.length > 0) ctx.issues.push(marker('plain', ctx.value));
		})
		.refine(() => false, {
			params: { [SENTINEL]: 'when' },
			when: (payload) => payload.issues.length > 0,
		})
		.catch((ctx) => new Refused(ctx.error.issues) as unknown as string)
		.refine((value) => {
			done = true;
			outcome = value;
			return true;
		});

	return (narrow) => {
		let stored: z.core.$ZodRawIssue[] = [];
		const replay = narrow(
			z.string().check((ctx) => {
				ctx.issues.push(...stored);
			}),
		);

		const raise = (
			ctx: z.core.ParsePayload<string>,
			result: unknown,
			async: boolean,
		) => {
			let next: boolean | undefined = true;
			if (result instanceof Refused) {
				const kinds = new Set(result.issues.map(sentinelOf));
				// Both ran: every issue continues. Only the `when` one: an issue
				// that does not continue. Neither: an explicit abort.
				if (!async && !kinds.has('plain'))
					next = kinds.has('when') ? undefined : false;
				stored = result.issues
					.filter((issue) => sentinelOf(issue) === undefined)
					.map((issue) => raw(issue, ctx.value, next, 'format'));
			} else if (result !== ctx.value) {
				throw new Error(
					`The format "${name}" rewrote the value it checked: a format checks the value and never changes it, so the server and the client check the value as it was sent. Refuse what is not canonical with .regex() or .refine() instead of setting payload.value in a .check().`,
				);
			}
			const replayed = replay.safeParse(ctx.value);
			stored = [];
			if (replayed.success) return;
			for (const issue of replayed.error.issues) {
				const own = paramsOf(issue)?.[RULE_PARAM] === 'format';
				ctx.issues.push(raw(issue, ctx.value, own ? next : true));
			}
		};

		return z.string().check((ctx) => {
			done = false;
			outcome = undefined;
			const pending = probe.safeParseAsync(ctx.value);
			if (done) {
				pending.catch(() => {});
				raise(ctx, outcome, false);
				return undefined;
			}
			const later = pending.then((result) =>
				raise(ctx, result.success ? result.data : undefined, true),
			);
			later.catch(() => {});
			onAsync();
			return later;
		}) as unknown as StringSchema;
	};
}

function marker(kind: string, value: string): z.core.$ZodRawIssue {
	return {
		code: 'custom',
		message: '',
		input: value,
		params: { [SENTINEL]: kind },
		continue: true,
	};
}

function paramsOf(
	issue: z.core.$ZodIssue,
): Record<string, unknown> | undefined {
	return 'params' in issue
		? (issue.params as Record<string, unknown> | undefined)
		: undefined;
}

function sentinelOf(issue: z.core.$ZodIssue): unknown {
	return paramsOf(issue)?.[SENTINEL];
}

/** A finalised issue raised again; marked `constraint` when given. */
function raw(
	issue: z.core.$ZodIssue,
	input: string,
	next: boolean | undefined,
	constraint?: string,
): z.core.$ZodRawIssue {
	const params = constraint
		? { ...paramsOf(issue), [RULE_PARAM]: constraint }
		: paramsOf(issue);
	const { continue: _, ...rest } = issue as z.core.$ZodIssue & {
		continue?: boolean;
	};
	return {
		...rest,
		input,
		...(params && { params }),
		...(next !== undefined && { continue: next }),
	} as z.core.$ZodRawIssue;
}
