import * as all from './all';
import type { BuiltInFormat } from './format';

/**
 * Every built-in format, keyed by the value `@constraint(format: "...")`
 * takes. Derived from what `./all` exports, so a new format is one file and
 * one line there.
 */
export const formats = Object.fromEntries(
	Object.values(all).map((format) => [format.name, format]),
) as { readonly [N in FormatName]: BuiltInFormat<N> };

/** A value `@constraint(format: "...")` takes without the application's formats. */
export type FormatName = (typeof all)[keyof typeof all]['name'];
