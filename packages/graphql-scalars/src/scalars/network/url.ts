import { urlSchema } from '@nxgt/zod/scalars';
import { zodScalar } from '../../zod-scalar';

export { urlSchema };

export const URLScalar = zodScalar(urlSchema, {
	name: 'URL',
	description: 'An absolute http or https URL.',
	specifiedByURL: 'https://url.spec.whatwg.org/',
});
