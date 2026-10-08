import { z } from 'zod';
import { zodScalar } from '../../zod-scalar';

/**
 * A longitude in decimal degrees, a finite number from -180 to 180: `2.3522`,
 * not `2°21'E`. Conventionally on WGS 84, as GeoJSON and most APIs use; the
 * datum is not checked. `-0` is taken, as by the other float scalars. Both
 * `-180` and `180` are taken: they are one meridian.
 */
export const longitudeSchema = z.number().min(-180).max(180);

export const LongitudeScalar = zodScalar(longitudeSchema, {
	name: 'Longitude',
	description: 'A longitude in decimal degrees, from -180 to 180.',
});
