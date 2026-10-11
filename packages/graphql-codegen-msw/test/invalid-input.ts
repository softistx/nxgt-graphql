// An application's own answer to an invalid input, for the `invalidInput`
// option: one 422 error listing each path and Zod's message.
import type { InvalidInput } from '@nxgt/graphql-codegen-msw/runtime';

export const invalidInput: InvalidInput = (issues, operation) => ({
	error: {
		message: `${operation.name} refused`,
		extensions: {
			code: 'UNPROCESSABLE',
			problems: issues.map((issue) => ({
				at: issue.path.join('/'),
				why: issue.message,
			})),
		},
	},
	status: 422,
});
