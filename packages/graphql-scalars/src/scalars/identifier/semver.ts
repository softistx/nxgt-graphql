import { semverSchema } from '@nxgt/zod/scalars';
import { zodScalar } from '../../zod-scalar';

export { semverSchema };

export const SemVerScalar = zodScalar(semverSchema, {
	name: 'SemVer',
	description: 'A Semantic Versioning 2.0.0 version, such as 1.0.0-rc.1.',
	specifiedByURL: 'https://semver.org/spec/v2.0.0.html',
});
