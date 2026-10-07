import { z } from 'zod';
import { defineFormat } from './format';

export const dateFormat = defineFormat({
	name: 'date',
	toZod: () => z.iso.date(),
	toCode: () => 'z.iso.date()',
});
