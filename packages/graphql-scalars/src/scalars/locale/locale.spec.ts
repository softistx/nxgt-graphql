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
