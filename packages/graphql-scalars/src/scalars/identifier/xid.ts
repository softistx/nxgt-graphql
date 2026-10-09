import { xidSchema } from '@nxgt/zod/scalars';
import { zodScalar } from '../../zod-scalar';

export { xidSchema };

export const XIDScalar = zodScalar(xidSchema, {
	name: 'XID',
	description: 'An xid: 20 characters of lowercase base32hex.',
	specifiedByURL: 'https://github.com/rs/xid',
});
