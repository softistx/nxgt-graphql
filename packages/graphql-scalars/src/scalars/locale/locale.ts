import { z } from 'zod';
import { zodScalar } from '../../zod-scalar';

/** The tag `Intl` writes for `tag`, or `undefined` when it is not well-formed. */
function canonical(tag: string): string | undefined {
	try {
		return Intl.getCanonicalLocales(tag)[0];
	} catch {
		return undefined;
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

/**
 * Whether `tag` is a well-formed BCP 47 tag in canonical case. The case rule
 * is written here, not taken from `Intl`: engines do not agree on which
 * aliases they rewrite (V8 turns `tl` into `fil` and `en-UK` into `en-GB`,
 * JavaScriptCore keeps both), so an alias is not refused. Extensions are
 * compared with what `Intl` writes, so their order is canonical.
 */
function isLocale(tag: string): boolean {
	const written = canonical(tag);
	if (written === undefined) return false;
	const subtags = tag.split('-');
	const start = subtags.findIndex((subtag) => subtag.length === 1);
	if (start === -1) return hasCanonicalCase(subtags);
	const extensions = `-${subtags.slice(start).join('-')}`;
	return (
		hasCanonicalCase(subtags.slice(0, start)) && written.endsWith(extensions)
	);
}

/**
 * A well-formed BCP 47 language tag in canonical case, kept as sent: `fr`,
 * `fr-FR`, `zh-Hant-TW`, `en-US-u-ca-buddhist`. Another case (`fr-fr`), `_`
 * (`en_US`) or an extension out of order is refused, not rewritten. An alias
 * (`tl`, `iw`, `en-UK`) is taken. Well-formed only: the subtags are not
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
