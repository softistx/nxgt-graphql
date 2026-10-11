import { z } from 'zod';
import { RULE_PARAM } from '../rules/rule';
import type { Format, StringSchema } from './format';
import { formats as builtIns, type FormatName } from './index';

/**
 * The application's own formats, keyed by the name `@constraint(format:
 * "...")` gives them: each a Zod string schema, `z.string()` or a string
 * format (`z.email()`), narrowed (`.regex()`, `.refine()`) but never
 * transformed nor rewritten (`.trim()`, `.toLowerCase()`, `z.url()`,
 * `z.coerce.string()`), so the resolver receives what was sent.
 */
export type FormatSchemas = { readonly [name: string]: StringSchema };

/**
 * `F` with every key that names a built-in format typed `never`, so
 * replacing one is a type error before it is a startup error. The keys are
 * optional: a record typed wider than its literal (`FormatSchemas`,
 * `Record<string, z.ZodString>`) may hold none of them, and passes.
 */
export type OwnFormats<F extends FormatSchemas> = F & {
	readonly [K in keyof F & FormatName]?: never;
};

const NAME = /^[a-z][a-z0-9-]*$/;

/**
 * Every format `@constraint(format: "...")` can name: the built-in ones,
 * then the application's own. A lookup is one `Map` read, however many
 * formats there are.
 */
export class FormatRegistry {
	readonly #formats = new Map<string, Format>();
	#async: string | undefined;

	/**
	 * Fails, naming the format, on a bad name, a built-in's name, a schema
	 * that is not a string's, one zod cannot run, or one that rewrites the
	 * value.
	 */
	constructor(own: FormatSchemas = {}) {
		for (const format of Object.values(builtIns))
			this.#formats.set(format.name, format);
		for (const [name, schema] of Object.entries(own)) {
			if (!NAME.test(name)) {
				throw new Error(
					`Invalid format name ${JSON.stringify(name)}: write it in lowercase letters, digits and hyphens, starting with a letter.`,
				);
			}
			if (this.#formats.has(name)) {
				throw new Error(
					`The format "${name}" is built in: give yours another name.`,
				);
			}
			if (!isStringSchema(schema)) {
				throw new Error(
					`The format "${name}" is not a Zod string schema: write z.string() or a string format such as z.email(), narrowed with .regex() or .refine(), never transformed.`,
				);
			}
			if (!runnable(schema)) {
				throw new Error(
					`The format "${name}" cannot be run: its definition reads type: 'string' but it has no _zod.run, so it was not built by zod 4. Pass the schema z.string() or a string format returns, not an object shaped like one.`,
				);
			}
			if (rewrites(schema)) {
				throw new Error(
					`The format "${name}" rewrites the value (.trim(), .toLowerCase(), .toUpperCase(), .normalize(), .slugify(), .overwrite(), z.url(), z.httpUrl() or z.coerce.string()): refuse what is not canonical with .regex() or .refine() instead, so the server and the client check the value as it was sent.`,
				);
			}
			const own = marked(name, schema, () => {
				this.#async = name;
			});
			this.#formats.set(name, { name, toZod: () => own });
		}
	}

	/** The format named `name`, or an error that lists the known ones. */
	named(name: string): Format {
		const format = this.#formats.get(name);
		if (format) return format;
		throw new Error(
			`Unknown @constraint format "${name}". Known formats: ${[...this.#formats.keys()].join(', ')}.`,
		);
	}

	/**
	 * The format of the application that last went async, then forgotten: read
	 * right after a synchronous parse threw zod's `$ZodAsyncError`, it names the
	 * format that made it throw (zod stops at the first check that returns a
	 * promise, and only an application's format can).
	 */
	takeAsync(): string | undefined {
		const name = this.#async;
		this.#async = undefined;
		return name;
	}
}

/**
 * Whether a value is a Zod string schema, read from its definition rather
 * than `instanceof`, so a schema from another copy of zod is recognised. A
 * transform or a codec is a pipe, `.optional()` an optional: neither passes.
 */
function isStringSchema(value: unknown): value is StringSchema {
	return definition(value)?.type === 'string';
}

/**
 * Whether zod can run the schema: `marked` calls its `_zod.run` on every
 * value, so a definition alone (an object that only reads `type: 'string'`)
 * would pass startup and fail each request instead.
 */
function runnable(schema: StringSchema): boolean {
	return (
		typeof (schema as { _zod?: { run?: unknown } } | null)?._zod?.run ===
		'function'
	);
}

/**
 * Whether a string schema rewrites the value it checks, though it stays
 * `type: 'string'`: `z.coerce.string()` (`coerce: true`) turns a number
 * into a string; `z.url()`, `z.httpUrl()` and `.url()` (`format: 'url'`, as
 * the schema or as one of its checks) trim the value and drop its tabs and
 * newlines, or normalise it; `.trim()`, `.toLowerCase()`, `.toUpperCase()`,
 * `.normalize()`, `.slugify()` and `.overwrite()` are each a check whose
 * definition reads `check: 'overwrite'`. Every other string format of zod 4
 * only checks. `format: 'url'` is read as the format's name, so a
 * `z.stringFormat('url', …)` of the application's is refused too. The
 * server checks the value as sent; a client chaining rules on a rewriting
 * schema would check the rewritten one. A custom check that sets the value
 * cannot be read here: `marked` catches it when it runs.
 */
function rewrites(schema: StringSchema): boolean {
	const def = definition(schema);
	if (def?.coerce || def?.format === 'url') return true;
	return (def?.checks ?? []).some((check) => {
		const own = definition(check);
		return own?.check === 'overwrite' || own?.format === 'url';
	});
}

type Definition = {
	type?: unknown;
	coerce?: unknown;
	format?: unknown;
	check?: unknown;
	checks?: readonly unknown[];
};

function definition(value: unknown): Definition | undefined {
	return (value as { _zod?: { def?: Definition } } | null)?._zod?.def;
}

/**
 * The application's schema as a plain string schema the rules can narrow,
 * each of its issues re-raised as it was (code, message, and an abort that
 * stops the rules chained after it) and marked as the format's: a
 * `.regex()` inside it is the format's refusal, not `pattern`'s.
 * The value is checked, never changed: a schema that still returns another
 * value (a custom `.check()` setting `payload.value`, which `rewrites`
 * cannot see) throws, naming the format, as a resolver's bug would.
 *
 * The schema runs once per value, through its own `_zod.run` (what its
 * `safeParse` and `safeParseAsync` call) with `async: true`: a schema whose
 * checks are all synchronous returns its result at once, one with an async
 * check returns a promise, whatever zod copy it comes from. Nothing is
 * started and dropped, as a synchronous `safeParse` would drop the promise of
 * an async refine before running it again. That promise, returned to the
 * enclosing parse, gets a handler too: a synchronous parse (a default
 * value's check) throws zod's async error and drops it, and its rejection
 * must not surface as an unhandled one. `onAsync` is told before it is
 * returned.
 */
function marked(
	name: string,
	schema: StringSchema,
	onAsync: () => void,
): StringSchema {
	return z.string().superRefine((value, ctx) => {
		const raise = (result: z.core.ParsePayload<unknown>) => {
			if (result.issues.length === 0 && result.value !== value) {
				throw new Error(
					`The format "${name}" rewrote the value it checked: a format checks the value and never changes it, so the server and the client check the value as it was sent. Refuse what is not canonical with .regex() or .refine() instead of setting payload.value in a .check().`,
				);
			}
			for (const raw of result.issues) {
				// Finalised as the schema's own parse would: its message settled.
				const issue = z.core.util.finalizeIssue(raw, RUN, z.core.config());
				const params = 'params' in issue ? issue.params : undefined;
				ctx.addIssue({
					...issue,
					params: { ...params, [RULE_PARAM]: 'format' },
					// finalizeIssue drops `continue`: an aborting check of the format
					// (`.refine(…, { abort: true })`) still stops the rules after it,
					// as it does in the generated client. Once the format has gone
					// async, zod has already run those rules: the abort then stops
					// nothing, on the server only.
					...(raw.continue === false && { continue: false }),
				} as Parameters<typeof ctx.addIssue>[0]);
			}
		};
		const result = schema._zod.run({ value, issues: [] }, RUN);
		if (!(result instanceof Promise)) {
			raise(result);
			return undefined;
		}
		const pending = result.then(raise);
		pending.catch(() => {});
		onAsync();
		return pending;
	});
}

/** How a format runs: async allowed, so an async check is never dropped. */
const RUN: z.core.ParseContextInternal = { async: true };

const builtInRegistry = new FormatRegistry();
const registries = new WeakMap<FormatSchemas, FormatRegistry>();

/**
 * The registry of a set of formats, built (and checked) once per record: a
 * code generator hands the same record for every field.
 */
export function registryOf(own?: FormatSchemas): FormatRegistry {
	if (!own) return builtInRegistry;
	let registry = registries.get(own);
	if (!registry) {
		registry = new FormatRegistry(own);
		registries.set(own, registry);
	}
	return registry;
}
