import { z } from 'zod';
import { defineFormat } from './format';

// graphql-constraint-directive's `uri` is validator's isURL: http, https or
// ftp. The scheme is required here, where isURL lets `example.com` through,
// and nothing else gets in: no `javascript:`, no `mailto:`.
export const uriFormat = defineFormat({
	name: 'uri',
	toZod: () => z.url({ protocol: /^(https?|ftp)$/ }),
	toCode: () => 'z.url({ protocol: /^(https?|ftp)$/ })',
});
