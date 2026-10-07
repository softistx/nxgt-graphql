import type { StringSchema } from '../rules/rule';

/**
 * One value of `@constraint(format: "...")`: the schema it stands for, as a
 * schema at startup and as source for a code generator.
 */
export interface Format<N extends string = string> {
	readonly name: N;
	readonly toZod: () => StringSchema;
	readonly toCode: () => string;
}

/** Declares a format, with its name kept literal. */
export function defineFormat<const N extends string>(
	format: Format<N>,
): Format<N> {
	return format;
}
