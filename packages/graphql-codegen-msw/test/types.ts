// What the generated handlers' types say, checked by typecheck: a resolver
// receives the operation's variables type and answers its result type.

import { errorResponse } from '@nxgt/graphql-codegen-msw/runtime';
import { fieldsError } from '@nxgt/graphql-validation';
import { HttpResponse } from 'msw';
import type { SignUpMutationVariables, UserQueryVariables } from './graphql';
import { mockSignUpMutation, mockUserQuery } from './msw';

type Equal<A, B> =
	(<T>() => T extends A ? 1 : 2) extends <T>() => T extends B ? 1 : 2
		? true
		: false;
const expectType = <T extends true>(_: T): void => {};

mockUserQuery(({ variables }) => {
	expectType<Equal<typeof variables, UserQueryVariables>>(true);
	return HttpResponse.json({
		data: { user: { id: String(variables.id), name: 'Ada', joined: null } },
	});
});

mockSignUpMutation(({ variables }) => {
	expectType<Equal<typeof variables, SignUpMutationVariables>>(true);
	return HttpResponse.json({ data: { signUp: null } });
});

// A result the operation does not select is refused.
mockUserQuery(() => {
	const user = { id: 'u_1', name: 'Ada', joined: null };
	return HttpResponse.json({
		// @ts-expect-error: `nickname` is not in UserQuery's user.
		data: { user: { ...user, nickname: 'A' } },
	});
});

// Nothing returned lets the next handler answer, as in msw.
mockUserQuery(() => undefined);

// A generator is not a resolver here: msw would answer the next requests
// from its iterator, without checking their variables.
// @ts-expect-error: a generator function returns an iterator.
mockUserQuery(function* () {
	yield HttpResponse.json({ data: { user: null } });
});

// The endpoint and msw's `once`, per handler.
mockUserQuery(() => undefined, { endpoint: '*/graphql', once: true });

// An error helper is an answer too, returned or thrown.
mockSignUpMutation(() =>
	errorResponse(
		fieldsError('conflict', [{ path: 'person.email', code: 'taken' }], {
			status: 409,
		}),
	),
);
mockSignUpMutation(async () => {
	throw fieldsError('conflict', [], { status: 409 });
});
