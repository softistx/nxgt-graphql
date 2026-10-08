import { describe } from 'bun:test';
import { scalarCases } from '../../../test/scalar-cases';
import { LocaleScalar } from './locale';

describe('Locale', () => {
	scalarCases(LocaleScalar, {
		accepted: [
			'fr',
			'fr-FR',
			'en-US',
			'zh-Hant-TW',
			'zh-TW',
			'sr-Latn',
			'es-419',
			'en-US-u-ca-buddhist',
			'und',
			'xx',
			// Aliases: V8 rewrites these, JavaScriptCore does not.
			'tl',
			'tl-PH',
			'sh',
			'cmn',
			'en-UK',
			'sr-Cyrl-YU',
			// Aliases both engines rewrite.
			'iw',
			'in',
			'mo',
			// The same inside an extension, kept as sent.
			'en-t-iw',
			'en-t-tl',
			'de-t-en-uk',
			'en-u-ca-islamicc',
			'en-u-kb-yes',
			// Extensions in canonical order.
			'en-t-zh-hant',
			'en-t-d0-latn-m0-ungegn',
			'en-u-attr-ca-buddhist',
			'en-u-kn',
			'en-a-bbb-u-ca',
			'en-t-iw-u-ca-buddhist',
			// What follows `-x-` is private use, not an extension.
			'en-x-foo-u-ca',
		],
		refused: [
			'fr-fr',
			'FR',
			'Fr',
			'en_US',
			'zh-hant-tw',
			'zh-HANT-TW',
			'sr-latn',
			'en-US-U-CA-BUDDHIST',
			'en-u-nu-latn-ca-buddhist',
			'en-u-ca-gregory-ca-buddhist',
			'en-u-foo-bar',
			'en-u-kn-true',
			'en-u-Ca-buddhist',
			'en-T-iw',
			'de-t-en-UK',
			'en-t-zh-Hant',
			'en-t-m0-ungegn-d0-latn',
			'en-u-ca-a-bbb',
			'en-u-ca-buddhist-t-iw',
			'en-X-foo',
			'i-klingon',
			'x-foo',
			'en-',
			`en-x-${'a1234567-'.repeat(30)}a`,
			' fr',
			'',
			1,
		],
	});
});
