import { z } from 'zod';
import { zodScalar } from '../../zod-scalar';

/**
 * The max UUID, all bits set, in any case: Zod's `z.uuid()` pattern has it
 * lowercase only. The format stays `uuid`, so the message is Zod's.
 */
const MAX = '^[fF]{8}-[fF]{4}-[fF]{4}-[fF]{4}-[fF]{12}$';

/**
 * An RFC 9562 UUID of any version 1 to 8, its variant bits `10`, or the nil
 * or the max UUID: 8-4-4-4-12 hexadecimal digits, in any case, kept as
 * sent. For a given version, use `UUIDv4` or `UUIDv7`; for any 8-4-4-4-12
 * string, `GUID`.
 */
export const uuidSchema = z.stringFormat(
	'uuid',
	new RegExp(`${z.regexes.uuid().source}|${MAX}`),
);

export const UUIDScalar = zodScalar(uuidSchema, {
	name: 'UUID',
	description: 'A UUID in its 8-4-4-4-12 hexadecimal form.',
	specifiedByURL: 'https://www.rfc-editor.org/rfc/rfc9562',
});
