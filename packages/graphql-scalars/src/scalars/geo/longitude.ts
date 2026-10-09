import { longitudeSchema } from '@nxgt/zod/scalars';
import { zodScalar } from '../../zod-scalar';

export { longitudeSchema };

export const LongitudeScalar = zodScalar(longitudeSchema, {
	name: 'Longitude',
	description: 'A longitude in decimal degrees, from -180 to 180.',
});
