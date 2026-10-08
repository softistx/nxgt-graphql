import { z } from 'zod';
import { zodScalar } from '../../zod-scalar';

/** Whether `Intl` takes `tag` as well-formed: engines agree on that much. */
function isWellFormed(tag: string): boolean {
	try {
		Intl.getCanonicalLocales(tag);
		return true;
	} catch {
		return false;
	}
}

/**
 * Whether the subtags before the first extension are in BCP 47's case: the
 * language lowercase, a script (four letters, second) Titlecase, a region
 * (two letters) uppercase, the variants lowercase.
 */
function hasCanonicalCase(subtags: readonly string[]): boolean {
	return subtags.every((subtag, index) => {
		if (index === 1 && /^[A-Za-z]{4}$/.test(subtag)) {
			return /^[A-Z][a-z]{3}$/.test(subtag);
		}
		if (index > 0 && /^[A-Za-z]{2}$/.test(subtag)) {
			return /^[A-Z]{2}$/.test(subtag);
		}
		return subtag === subtag.toLowerCase();
	});
}

/** Whether every string is after the one before it: sorted, no duplicate. */
function isAscending(keys: readonly string[]): boolean {
	return keys.every(
		(key, index) => index === 0 || (keys[index - 1] as string) < key,
	);
}

/**
 * Whether a `-u-` extension (RFC 6067) is in canonical order: its
 * attributes first, sorted, then its keywords sorted by key, each key once.
 * A keyword's `true` is written by leaving it out (`kn`, not `kn-true`).
 */
function isCanonicalUnicode(subtags: readonly string[]): boolean {
	const firstKey = subtags.findIndex((subtag) => subtag.length === 2);
	const attributes = firstKey === -1 ? subtags : subtags.slice(0, firstKey);
	if (!isAscending(attributes)) return false;
	const keys: string[] = [];
	for (let index = attributes.length; index < subtags.length; ) {
		keys.push(subtags[index] as string);
		let end = index + 1;
		while (end < subtags.length && (subtags[end] as string).length > 2) end++;
		if (end === index + 2 && subtags[index + 1] === 'true') return false;
		index = end;
	}
	return isAscending(keys);
}

/**
 * Whether a `-t-` extension (RFC 6497) is in canonical order: an optional
 * source language, then its fields sorted by key (a letter and a digit).
 */
function isCanonicalTransformed(subtags: readonly string[]): boolean {
	return isAscending(subtags.filter((subtag) => /^[a-z]\d$/.test(subtag)));
}

/**
 * Whether the extensions, from the first singleton on, are in canonical
 * form: lowercase, the singletons in ascending order, and `-u-` and `-t-`
 * each in its own order. `-x-` (private use) ends the tag: what follows it
 * is not read as extensions. A value's alias (`islamicc`, `kb-yes`) is kept,
 * as a language's alias is.
 */
function hasCanonicalExtensions(subtags: readonly string[]): boolean {
	if (subtags.some((subtag) => subtag !== subtag.toLowerCase())) return false;
	const singletons: string[] = [];
	for (let index = 0; index < subtags.length; ) {
		const singleton = subtags[index] as string;
		if (singleton === 'x') break;
		singletons.push(singleton);
		let end = index + 1;
		while (end < subtags.length && (subtags[end] as string).length > 1) end++;
		const body = subtags.slice(index + 1, end);
		if (singleton === 'u' && !isCanonicalUnicode(body)) return false;
		if (singleton === 't' && !isCanonicalTransformed(body)) return false;
		index = end;
	}
	return isAscending(singletons);
}

/**
 * Whether `tag` is a well-formed BCP 47 tag in canonical form. `Intl` says
 * only whether it is well-formed: engines do not agree on what they rewrite
 * (V8 turns `tl` into `fil`, `en-UK` into `en-GB` and `en-t-iw` into
 * `en-t-he`; JavaScriptCore keeps all three), so case and order are checked
 * here and an alias is not refused.
 */
function isLocale(tag: string): boolean {
	if (!isWellFormed(tag)) return false;
	const subtags = tag.split('-');
	const start = subtags.findIndex((subtag) => subtag.length === 1);
	if (start === -1) return hasCanonicalCase(subtags);
	return (
		hasCanonicalCase(subtags.slice(0, start)) &&
		hasCanonicalExtensions(subtags.slice(start))
	);
}

/**
 * A well-formed BCP 47 language tag in canonical case, kept as sent: `fr`,
 * `fr-FR`, `zh-Hant-TW`, `en-US-u-ca-buddhist`. Another case (`fr-fr`,
 * `en-U-CA-BUDDHIST`), `_` (`en_US`), or extensions or `-u-` keywords out
 * of order are refused, not rewritten. An alias (`tl`, `iw`, `en-UK`,
 * `en-t-iw`, `en-u-ca-islamicc`) is taken. Well-formed only: the subtags are not
 * checked against the IANA registry, so `xx` and `en-ZZ` pass. At most 255
 * characters.
 */
export const localeSchema = z
	.string()
	.max(255, { error: 'Invalid locale: at most 255 characters' })
	.refine(isLocale, {
		error: 'Invalid locale: expected a canonical BCP 47 tag',
	});

export const LocaleScalar = zodScalar(localeSchema, {
	name: 'Locale',
	description: 'A BCP 47 language tag in canonical form, such as fr-FR.',
	specifiedByURL: 'https://www.rfc-editor.org/rfc/rfc5646',
});
