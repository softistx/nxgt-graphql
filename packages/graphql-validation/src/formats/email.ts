import { z } from 'zod';
import { defineFormat } from './format';

export const emailFormat = defineFormat({
	name: 'email',
	toZod: () => z.email(),
	toCode: () => 'z.email()',
});
