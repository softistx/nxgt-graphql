import { z } from 'zod';
import { zodScalar } from '../../zod-scalar';

/**
 * An absolute `http:` or `https:` URL. Other schemes are refused —
 * `javascript:` and `data:` among them — since a client is likely to put
 * the value in an `href`. Like `z.url()`, it trims the value and drops
 * tabs and line breaks, both ways.
 */
// Exactly `^https?$`: Zod reads this source to also refuse
// `https:example.com` and `http:/x`, which a looser pattern lets through.
export const urlSchema = z.url({ protocol: /^https?$/ });

export const URLScalar = zodScalar(urlSchema, {
	name: 'URL',
	description: 'An absolute http or https URL.',
	specifiedByURL: 'https://url.spec.whatwg.org/',
});
