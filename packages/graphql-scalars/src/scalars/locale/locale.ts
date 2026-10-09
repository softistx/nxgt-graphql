import { localeSchema } from '@nxgt/zod/scalars';
import { zodScalar } from '../../zod-scalar';

export { localeSchema };

export const LocaleScalar = zodScalar(localeSchema, {
	name: 'Locale',
	description: 'A BCP 47 language tag in canonical form, such as fr-FR.',
	specifiedByURL: 'https://www.rfc-editor.org/rfc/rfc5646',
});
