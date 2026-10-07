import { z } from 'zod';
import { defineFormat } from './format';

export const dateTimeFormat = defineFormat({
	name: 'date-time',
	toZod: () => z.iso.datetime({ offset: true }),
	toCode: () => 'z.iso.datetime({ offset: true })',
});
