// An application types its own error extensions by declaration merging, as
// it would in a `.d.ts` of its own: `field` is then a `string | undefined`
// on `error.extensions` and on each `error.errors[i].extensions`.
import { type ApiErrorExtensions, isApiError } from '@nxgt/graphql-client';

declare module '@nxgt/graphql-client' {
	interface ApiErrorExtensions {
		field?: string;
	}
}

/** The refused field and its message, keyed as a form reads them. */
export function fieldMessage(error: unknown): Record<string, string> {
	if (!isApiError(error)) return {};
	const { field } = error.extensions;
	const first: string | undefined = error.errors[0]?.extensions?.field;
	// @ts-expect-error: `field` is a string, never a number
	const wrong: number | undefined = error.extensions.field;
	return field === undefined
		? { [String(first ?? wrong)]: error.message }
		: { [field]: error.message };
}

// Keys the package declares stay as typed, and any other is `unknown`.
export const extensions: ApiErrorExtensions = {
	code: 'BAD_USER_INPUT',
	field: 'email',
	other: 1,
};
export const status: number | undefined = extensions.http?.status;
export const other: unknown = extensions['other'];
