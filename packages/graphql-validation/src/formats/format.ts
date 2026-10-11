import type { z } from 'zod';
import type { Narrow } from './marked';

/** A string schema, plain or a format (`z.email()` is not a `z.ZodString`). */
export type StringSchema = z.ZodString | z.ZodStringFormat;

/**
 * One value of `@constraint(format: "...")`: the schema it stands for, as a
 * schema at startup and, for a built-in one, as source for a code generator.
 * A format of the application's own has no `toCode`: the generator writes a
 * reference to the application's schema instead.
 */
export interface Format<N extends string = string> {
	readonly name: N;
	readonly toZod: () => StringSchema;
	readonly toCode?: () => string;
	/**
	 * An application's format, narrowed by the rules written after it
	 * (`leafSchema` hands them): they run inside it, after its checks, so
	 * they see its abort even once it went async. A built-in format has none:
	 * the rules are chained on `toZod()`.
	 */
	readonly narrowed?: (narrow: Narrow) => StringSchema;
}

/** A format this package ships: written twice, as a schema and as source. */
export interface BuiltInFormat<N extends string = string> extends Format<N> {
	readonly toCode: () => string;
}

/** Declares a built-in format, with its name kept literal. */
export function defineFormat<const N extends string>(
	format: BuiltInFormat<N>,
): BuiltInFormat<N> {
	return format;
}
