import { describe } from 'bun:test';
import { scalarCases } from '../../../test/scalar-cases';
import { EmojiScalar } from './emoji';

describe('Emoji', () => {
	scalarCases(EmojiScalar, {
		accepted: ['😀', '👍🏽', '👨‍👩‍👧', '🇫🇷', '❤️', '❤', '1️⃣', '#️⃣', '🫠', '🏴󠁧󠁢󠁥󠁮󠁧󠁿'],
		refused: [
			'⃣',
			'🏻',
			`😀${'\ufe0f'.repeat(1000)}`,
			`${'👨\u200d'.repeat(200000)}👨`,
			'😀😀',
			'🇫🇷🇩🇪',
			'a',
			'😀a',
			' 😀',
			'😀\n',
			'‍',
			'️',
			'*',
			'',
			1,
		],
	});
});
