// The schema and operations the plugin's specs generate from. The files
// beside this one are generated from them: `bun run generated:write`.
import { constraintTypeDefs } from '@nxgt/graphql-validation';
import { buildSchema, parse } from 'graphql';

export const sdl = `${constraintTypeDefs}
"""A point in time, ISO 8601 with an offset."""
scalar DateTime

input PersonInput {
	firstName: String! @constraint(minLength: 2)
	email: String! @constraint(format: "email")
}

input SignUpInput {
	person: PersonInput!
	tags: [String!] @constraint(maxItems: 2)
	birth: DateTime
}

type User {
	id: ID!
	name: String!
	joined: DateTime
}

type Query {
	user(id: ID! @constraint(minLength: 3)): User
	users(first: Int = 10 @constraint(min: 1, max: 50)): [User!]!
}

type Mutation {
	signUp(input: SignUpInput!): User
}

type Subscription {
	joined: User
}
`;

export const schema = buildSchema(sdl);

export const documents = [
	{
		location: 'operations.graphql',
		document: parse(`
			query User($id: ID!) { user(id: $id) { id name joined } }
			query Users($first: Int) { users(first: $first) { id } }
			mutation SignUp($input: SignUpInput!) { signUp(input: $input) { id name } }
			# A subscription and an anonymous operation get no handler.
			subscription Joined { joined { id } }
		`),
	},
	{ location: 'anonymous.graphql', document: parse('query { users { id } }') },
];

/** The endpoint the generated handlers answer on. */
export const ENDPOINT = 'https://api.example.com/graphql';
