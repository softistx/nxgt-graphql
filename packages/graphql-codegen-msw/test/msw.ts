import type { GraphQLHandler } from "msw/graphql";
import { type GraphQLMockResolver, type MockOptions, type InvalidInput, mockOperation, invalidInputRefusal } from "@nxgt/graphql-codegen-msw/runtime";
import type { UserQuery, UserQueryVariables, UsersQuery, UsersQueryVariables, SignUpMutation, SignUpMutationVariables } from "./graphql";
import { zUserQueryVariables, zUsersQueryVariables, zSignUpMutationVariables } from "./zod";

/** Where the client sends its operations; a handler's `options.endpoint` overrides it. */
export const endpoint = "https://api.example.com/graphql";

/** How an invalid input is answered, without calling the resolver. */
export const invalidInput: InvalidInput = invalidInputRefusal();

/** Mocks the User query: `resolver` answers once the variables pass `zUserQueryVariables`. */
export function mockUserQuery(
	resolver: GraphQLMockResolver<UserQuery, UserQueryVariables>,
	options?: MockOptions,
): GraphQLHandler {
	return mockOperation({ type: "query", name: "User", variables: zUserQueryVariables, endpoint, invalidInput }, resolver, options);
}

/** Mocks the Users query: `resolver` answers once the variables pass `zUsersQueryVariables`. */
export function mockUsersQuery(
	resolver: GraphQLMockResolver<UsersQuery, UsersQueryVariables>,
	options?: MockOptions,
): GraphQLHandler {
	return mockOperation({ type: "query", name: "Users", variables: zUsersQueryVariables, endpoint, invalidInput }, resolver, options);
}

/** Mocks the SignUp mutation: `resolver` answers once the variables pass `zSignUpMutationVariables`. */
export function mockSignUpMutation(
	resolver: GraphQLMockResolver<SignUpMutation, SignUpMutationVariables>,
	options?: MockOptions,
): GraphQLHandler {
	return mockOperation({ type: "mutation", name: "SignUp", variables: zSignUpMutationVariables, endpoint, invalidInput }, resolver, options);
}
