import type { GraphQLHandler } from "msw/graphql";
import { type GraphQLMockResolver, type MockOptions, type InvalidInput, type InputTypes, mockOperation, badUserInputRefusal } from "@nxgt/graphql-codegen-msw/runtime";
import type { UserQuery, UserQueryVariables, UsersQuery, UsersQueryVariables, SignUpMutation, SignUpMutationVariables } from "./graphql";
import { zUserQueryVariables, zUsersQueryVariables, zSignUpMutationVariables } from "./zod";

/** Where the client sends its operations; a handler's `options.endpoint` overrides it. */
export const endpoint = "https://api.example.com/graphql";

/** How an invalid input is answered, without calling the resolver. */
export const invalidInput: InvalidInput = badUserInputRefusal;

/**
 * The input types the variables reach, from the schema: how a handler words
 * a value graphql refuses. Internal: its shape may change in any version.
 */
const inputTypes: InputTypes = {
	DateTime: { kind: "scalar" },
	ID: { kind: "builtin" },
	Int: { kind: "builtin" },
	PersonInput: {
		kind: "input",
		fields: {
			firstName: "String!",
			email: "String!",
		},
	},
	Role: {
		kind: "enum",
		values: [
			"ADMIN",
			"MEMBER",
		],
	},
	SignUpInput: {
		kind: "input",
		fields: {
			person: "PersonInput!",
			tags: "[String!]",
			birth: "DateTime",
		},
	},
	String: { kind: "builtin" },
};

/** Mocks the User query: `resolver` answers once the variables pass `zUserQueryVariables`. */
export function mockUserQuery(
	resolver: GraphQLMockResolver<UserQuery, UserQueryVariables>,
	options?: MockOptions,
): GraphQLHandler {
	return mockOperation({ type: "query", name: "User", variables: zUserQueryVariables, variableTypes: { id: "ID!" }, inputTypes, endpoint, invalidInput }, resolver, options);
}

/** Mocks the Users query: `resolver` answers once the variables pass `zUsersQueryVariables`. */
export function mockUsersQuery(
	resolver: GraphQLMockResolver<UsersQuery, UsersQueryVariables>,
	options?: MockOptions,
): GraphQLHandler {
	return mockOperation({ type: "query", name: "Users", variables: zUsersQueryVariables, variableTypes: { first: "Int", role: "Role" }, inputTypes, endpoint, invalidInput }, resolver, options);
}

/** Mocks the SignUp mutation: `resolver` answers once the variables pass `zSignUpMutationVariables`. */
export function mockSignUpMutation(
	resolver: GraphQLMockResolver<SignUpMutation, SignUpMutationVariables>,
	options?: MockOptions,
): GraphQLHandler {
	return mockOperation({ type: "mutation", name: "SignUp", variables: zSignUpMutationVariables, variableTypes: { input: "SignUpInput!" }, inputTypes, endpoint, invalidInput }, resolver, options);
}
