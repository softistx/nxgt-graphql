import { portSchema } from '@nxgt/zod/scalars';
import { zodScalar } from '../../zod-scalar';

export { portSchema };

export const PortScalar = zodScalar(portSchema, {
	name: 'Port',
	description: 'A TCP or UDP port number, from 0 to 65535.',
	literals: 'integer',
});
