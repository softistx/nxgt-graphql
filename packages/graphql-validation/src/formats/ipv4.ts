import { z } from 'zod';
import { defineFormat } from './format';

export const ipv4Format = defineFormat({
	name: 'ipv4',
	toZod: () => z.ipv4(),
	toCode: () => 'z.ipv4()',
});
