import { emojiSchema } from '@nxgt/zod/scalars';
import { zodScalar } from '../../zod-scalar';

export { emojiSchema };

export const EmojiScalar = zodScalar(emojiSchema, {
	name: 'Emoji',
	description: 'One emoji, such as 👍.',
	specifiedByURL: 'https://www.unicode.org/reports/tr51/',
});
