import { z } from 'zod';
import { zodScalar } from '../../zod-scalar';

/** The name `Intl` resolves `name` to, or `undefined` when it knows none. */
function resolved(name: string): string | undefined {
	try {
		return new Intl.DateTimeFormat('en-US', {
			timeZone: name,
		}).resolvedOptions().timeZone;
	} catch {
		return undefined;
	}
}

/** The IANA names whose words do not follow the shapes below. */
const MIXED_CASE = new Set([
	'America/Argentina/ComodRivadavia',
	'Antarctica/DumontDUrville',
	'Antarctica/McMurdo',
	'Brazil/DeNoronha',
	'Chile/EasterIsland',
	'Mexico/BajaNorte',
	'Mexico/BajaSur',
]);

/**
 * How a word of an IANA name is spelled: `Paris`, an abbreviation (`US`,
 * `EST5EDT`), a lowercase particle (`au`, `es`), `GMT+5`, or digits.
 */
const WORD =
	/^(?:[A-Z][a-z]*|[A-Z]{2,4}\d?[A-Z]{0,3}|[a-z]{2}|GMT[+-]?\d{0,2}|\d+)$/;

/**
 * Whether `name` is spelled as IANA spells it, for an alias the runtime
 * rewrites to another name (Node does), where nothing is left to compare
 * the case with. Measured on every tzdata name: it refuses none of them, and
 * lets through only miscasings whose words still look like IANA words
 * (`ASIA/Kolkata`, `ZULU`, `Prc`).
 */
function hasIanaCase(name: string): boolean {
	return (
		MIXED_CASE.has(name) || name.split(/[/_-]/).every((word) => WORD.test(word))
	);
}

/** Names already accepted. Refusals are not kept, so a client cannot grow it. */
const known = new Set<string>();

/**
 * Whether `name` is an IANA time zone the runtime knows, spelled with its
 * own case. An alias (`Asia/Calcutta`, `US/Pacific`) is one: runtimes do not
 * agree on which name of a zone is canonical (Node turns `Asia/Kolkata`
 * into `Asia/Calcutta`, Bun keeps both), so neither is refused. An offset
 * (`+05:30`), which `Intl` also takes, is `UtcOffset`'s.
 */
function isTimeZone(name: string): boolean {
	if (known.has(name)) return true;
	if (!/^[A-Za-z]/.test(name)) return false;
	const spelled = resolved(name);
	if (spelled === undefined) return false;
	// The runtime spells this zone itself: the case must be the same.
	const ok =
		spelled.toLowerCase() === name.toLowerCase()
			? spelled === name
			: hasIanaCase(name);
	if (ok) known.add(name);
	return ok;
}

/**
 * An IANA time zone name (`Europe/Paris`, `America/New_York`, `UTC`), as the
 * runtime's `Intl` knows it, in its own case, kept as sent. A zone newer
 * than the runtime's time zone data is refused there.
 */
export const timeZoneSchema = z
	.string()
	.refine(isTimeZone, { error: 'Invalid time zone: expected an IANA name' });

export const TimeZoneScalar = zodScalar(timeZoneSchema, {
	name: 'TimeZone',
	description: 'An IANA time zone name, such as Europe/Paris.',
	specifiedByURL: 'https://www.iana.org/time-zones',
});
