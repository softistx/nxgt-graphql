import { z } from 'zod';
import { defineFormat } from './format';

export const uriFormat = defineFormat({
	name: 'uri',
	toZod: () => z.url(),
	toCode: () => 'z.url()',
});
