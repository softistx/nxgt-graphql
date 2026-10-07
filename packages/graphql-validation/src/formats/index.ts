import * as all from './all';
import type { Format } from './format';

/**
 * Every format, keyed by the value `@constraint(format: "...")` takes.
 * Derived from what `./all` exports, so a new format is one file and one
 * line there.
 */
export const formats: Readonly<Record<string, Format>> = Object.fromEntries(
	Object.values(all).map((format) => [format.name, format]),
);

/** The format named `name`, or an error that lists the known ones. */
export function formatNamed(name: string): Format {
	const format = formats[name];
	if (format) return format;
	throw new Error(
		`Unknown @constraint format "${name}". Known formats: ${Object.keys(formats).join(', ')}.`,
	);
}
