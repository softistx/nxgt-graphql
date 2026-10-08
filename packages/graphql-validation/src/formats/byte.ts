import { z } from 'zod';
import { defineFormat } from './format';

export const byteFormat = defineFormat({
	name: 'byte',
	toZod: () => z.base64(),
	toCode: () => 'z.base64()',
});
