import { z } from 'zod';
import { defineFormat } from './format';

export const ipv6Format = defineFormat({
	name: 'ipv6',
	toZod: () => z.ipv6(),
	toCode: () => 'z.ipv6()',
});
