import { latitudeSchema } from '@nxgt/zod/scalars';
import { zodScalar } from '../../zod-scalar';

export { latitudeSchema };

export const LatitudeScalar = zodScalar(latitudeSchema, {
	name: 'Latitude',
	description: 'A latitude in decimal degrees, from -90 to 90.',
});
