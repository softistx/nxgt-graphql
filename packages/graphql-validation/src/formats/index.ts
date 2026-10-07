import * as all from './all';
import type { Format } from './format';

/**
 * Every format, keyed by the value `@constraint(format: "...")` takes.
 * Derived from what `./all` exports, so a new format is one file and one
 * line there.
 */
export const formats = Object.fromEntries(
	Object.values(all).map((format) => [format.name, format]),
) as { readonly [N in FormatName]: Format<N> };

/** A value `@constraint(format: "...")` takes. */
export type FormatName = (typeof all)[keyof typeof all]['name'];

/** The format named `name`, or an error that lists the known ones. */
export function formatNamed(name: string): Format {
	if (Object.hasOwn(formats, name)) return formats[name as FormatName];
	throw new Error(
		`Unknown @constraint format "${name}". Known formats: ${Object.keys(formats).join(', ')}.`,
	);
}
