import { z } from 'zod';
import { zodScalar } from '../../zod-scalar';

/**
 * Any 8-4-4-4-12 hexadecimal string, with no version or variant check, in
 * either case: what a Microsoft GUID or a nil UUID looks like. For a real
 * RFC 9562 UUID, use `UUID`.
 */
export const guidSchema = z.guid();

export const GUIDScalar = zodScalar(guidSchema, {
	name: 'GUID',
	description: 'A GUID: 8-4-4-4-12 hexadecimal digits, with no version check.',
});
