import { z } from 'zod';
import { RULE_PARAM } from '../rules/rule';
import type { Format, StringSchema } from './format';
import { formats as builtIns, type FormatName } from './index';

/**
 * The application's own formats, keyed by the name `@constraint(format:
 * "...")` gives them: each a Zod string schema, `z.string()` or a string
 * format (`z.email()`), narrowed (`.regex()`, `.refine()`) but never
 * transformed nor rewritten (`.trim()`, `.toLowerCase()`), so the resolver
 * receives what was sent.
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

	/**
	 * Fails, naming the format, on a bad name, a built-in's name, a schema
	 * that is not a string's, or one that rewrites the value.
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
			if (rewrites(schema)) {
				throw new Error(
					`The format "${name}" rewrites the value (.trim(), .toLowerCase(), .toUpperCase(), .normalize() or .overwrite()): refuse what is not canonical with .regex() or .refine() instead, so the server and the client check the value as it was sent.`,
				);
			}
			const own = marked(schema);
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
}

/**
 * Whether a value is a Zod string schema, read from its definition rather
 * than `instanceof`, so a schema from another copy of zod is recognised. A
 * transform or a codec is a pipe, `.optional()` an optional: neither passes.
 */
function isStringSchema(value: unknown): value is StringSchema {
	const def = (value as { _zod?: { def?: { type?: unknown } } } | null)?._zod
		?.def;
	return def?.type === 'string';
}

/**
 * Whether a string schema rewrites the value it checks: `.trim()`,
 * `.toLowerCase()`, `.toUpperCase()`, `.normalize()` and `.overwrite()` are
 * each a check whose definition reads `check: 'overwrite'`, on a schema
 * that stays `type: 'string'`. The server checks the value as sent; a
 * client chaining rules on a rewriting schema would check the rewritten one.
 */
function rewrites(schema: StringSchema): boolean {
	const checks = (schema as { _zod: { def: { checks?: readonly unknown[] } } })
		._zod.def.checks;
	return (checks ?? []).some(
		(check) =>
			(check as { _zod?: { def?: { check?: unknown } } } | null)?._zod?.def
				?.check === 'overwrite',
	);
}

/**
 * The application's schema as a plain string schema the rules can narrow,
 * each of its issues re-raised as it was (code, message) and marked as the
 * format's: a `.regex()` inside it is the format's refusal, not `pattern`'s.
 * The value is checked, never changed. An async check stays async: a
 * synchronous parse throws as the schema itself would.
 */
function marked(schema: StringSchema): StringSchema {
	return z.string().superRefine((value, ctx) => {
		const raise = (result: z.ZodSafeParseResult<string>) => {
			for (const issue of result.error?.issues ?? []) {
				const params = 'params' in issue ? issue.params : undefined;
				ctx.addIssue({
					...issue,
					params: { ...params, [RULE_PARAM]: 'format' },
				} as Parameters<typeof ctx.addIssue>[0]);
			}
		};
		let result: z.ZodSafeParseResult<string>;
		try {
			result = schema.safeParse(value);
		} catch (error) {
			if (!(error instanceof z.core.$ZodAsyncError)) throw error;
			return schema.safeParseAsync(value).then(raise);
		}
		raise(result);
		return undefined;
	});
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
