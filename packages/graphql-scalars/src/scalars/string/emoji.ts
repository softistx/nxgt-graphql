import { z } from 'zod';
import { zodScalar } from '../../zod-scalar';

/**
 * The longest emoji in Unicode's list is 10 code points (15 UTF-16 code
 * units); Zod's `max` counts code points, and 32 is room.
 */
const MAX_LENGTH = 32;

// Built on first use, not at import: a runtime without `Intl.Segmenter`
// then fails `Emoji` alone, as a GraphQLError, rather than every scalar.
let graphemes: Intl.Segmenter | undefined;

/** Whether `text` is one user-perceived character. */
function isOneGrapheme(text: string): boolean {
	graphemes ??= new Intl.Segmenter('en', { granularity: 'grapheme' });
	const iterator = graphemes.segment(text)[Symbol.iterator]();
	return !iterator.next().done && iterator.next().done === true;
}

/**
 * Whether `text` has a base an emoji is drawn from: a pictograph, a
 * regional indicator, or a keycap's `#`, `*` or digit. Zod's `z.emoji()`
 * also takes a lone combining keycap (U+20E3).
 */
function hasBase(text: string): boolean {
	return (
		/[\p{Extended_Pictographic}\p{Regional_Indicator}]/u.test(text) ||
		/^[#*0-9]\uFE0F?\u20E3$/u.test(text)
	);
}

/**
 * Whether the joiners and modifiers sit where a sequence puts them, which
 * neither Zod nor `Intl.Segmenter` checks: no joiner at the end, one
 * variation selector at a time, one skin tone per base, and regional
 * indicators in pairs (a flag; the pair is not checked against the
 * country codes).
 */
function isWellFormedSequence(text: string): boolean {
	const indicators = text.match(/\p{Regional_Indicator}/gu)?.length ?? 0;
	return (
		!text.endsWith('\u200D') &&
		!text.includes('\uFE0F\uFE0F') &&
		!/[\u{1F3FB}-\u{1F3FF}]\uFE0F?[\u{1F3FB}-\u{1F3FF}]/u.test(text) &&
		indicators % 2 === 0
	);
}

/**
 * One emoji, as one user-perceived character: `😀`, `👍🏽`, `👨‍👩‍👧`,
 * `🇫🇷`, `1️⃣`, at most 32 code points. Two emoji side by side (`😀😀`), text
 * around one, a lone joiner, variation selector, skin tone or keycap mark is
 * refused; so are a trailing joiner, two variation selectors or two skin
 * tones in a row, and a lone regional indicator (see
 * {@link isWellFormedSequence}). Every sequence of Unicode's
 * `emoji-test.txt` 18.0 is taken, the skin-tone components alone aside. Zod's `z.emoji()` checks that every code point is an emoji's;
 * `Intl.Segmenter` that they make one character, by the runtime's Unicode
 * data, so a sequence newer than it may count as two. Needs
 * `Intl.Segmenter` (Firefox 125, Safari 14.1).
 */
export const emojiSchema = z
	.string()
	.max(MAX_LENGTH, { error: 'Invalid emoji: too long' })
	.pipe(z.emoji({ error: 'Invalid emoji' }))
	.refine(hasBase, { error: 'Invalid emoji' })
	.refine(isWellFormedSequence, { error: 'Invalid emoji' })
	.refine(isOneGrapheme, { error: 'Invalid emoji: expected exactly one' });

export const EmojiScalar = zodScalar(emojiSchema, {
	name: 'Emoji',
	description: 'One emoji, such as 👍.',
	specifiedByURL: 'https://www.unicode.org/reports/tr51/',
});
