import { z } from 'zod';
import { defineFormat } from './format';

export const uuidFormat = defineFormat({
	name: 'uuid',
	toZod: () => z.uuid(),
	toCode: () => 'z.uuid()',
});
