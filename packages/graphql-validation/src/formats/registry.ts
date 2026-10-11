import type { Format, StringSchema } from './format';
import { formats as builtIns, type FormatName } from './index';
import { marked } from './marked';

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
					`The format "${name}" cannot be run: its definition reads type: 'string' but it has no safeParse, safeParseAsync or superRefine, so it is not a schema of zod 4's classic API. Pass the schema z.string() or a string format returns, not an object shaped like one.`,
				);
			}
			if (rewrites(schema)) {
				throw new Error(
					`The format "${name}" rewrites the value (.trim(), .toLowerCase(), .toUpperCase(), .normalize(), .slugify(), .overwrite(), z.url(), z.httpUrl() or z.coerce.string()): refuse what is not canonical with .regex() or .refine() instead, so the server and the client check the value as it was sent.`,
				);
			}
			const own = marked(name, schema, {
				async: checksAsync(schema),
				onAsync: () => {
					this.#async = name;
				},
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
 * Whether zod can run the schema through the public API `marked` uses on
 * every value, so a definition alone (an object that only reads `type:
 * 'string'`) fails startup rather than each request.
 */
function runnable(schema: StringSchema): boolean {
	const api = schema as unknown as Record<string, unknown>;
	return ['safeParse', 'safeParseAsync', 'superRefine'].every(
		(method) => typeof api[method] === 'function',
	);
}

/**
 * Whether the definition shows an async check: an `async` function in a
 * `.refine()`. A hint only, read once at startup: an async `.superRefine()`
 * or a function that returns a promise without being `async` is learnt from
 * the first value instead (`marked`).
 */
function checksAsync(schema: StringSchema): boolean {
	return (definition(schema)?.checks ?? []).some(
		(check) =>
			(definition(check)?.fn as { constructor?: { name?: unknown } } | null)
				?.constructor?.name === 'AsyncFunction',
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
	fn?: unknown;
	checks?: readonly unknown[];
};

function definition(value: unknown): Definition | undefined {
	return (value as { _zod?: { def?: Definition } } | null)?._zod?.def;
}

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
