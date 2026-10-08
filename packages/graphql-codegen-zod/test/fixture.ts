// The schema and operations the plugin's specs generate from: every kind of
// type, constraint and default the plugin writes. `test/generated.ts` is
// what the plugin writes for them, typechecked with the package.
import { constraintTypeDefs } from '@nxgt/graphql-validation';
import { buildSchema, parse } from 'graphql';

export const sdl = `${constraintTypeDefs}
"""A point in time, ISO 8601 with an offset."""
scalar DateTime

"""Who someone is."""
enum Role { ADMIN USER }

input Address {
	"The street and number."
	street: String! @constraint(minLength: 2, maxLength: 40)
	zip: String @constraint(pattern: "^[0-9]{5}$")
}

"""A filter that nests."""
input Filter {
	and: [Filter!] @constraint(maxItems: 3)
	name: String @constraint(startsWith: "n")
}

input Prefs {
	tags: [String!]
	grid: [[Int]]
	owner: ID = 7
	ids: [ID!] = 1
}

input SignUpInput {
	email: String! @constraint(format: "email")
	name: String! @constraint(minLength: 2)
	age: Int @constraint(min: 13, max: 120)
	role: Role = USER
	tags: [String!] = "new" @constraint(minItems: 1, maxLength: 8)
	address: Address
	birth: DateTime
	prefs: Prefs = { tags: "x", grid: 1 }
}

input Contact @oneOf {
	email: String @constraint(format: "email")
	phone: String @constraint(minLength: 6)
}

type User { id: ID!, name: String! }

interface Node { id: ID! }

type Query {
	user("At least three characters." id: ID! @constraint(minLength: 3)): User
	users(filter: Filter, first: Int = 10 @constraint(min: 1, max: 50)): [User!]!
	reach(contact: Contact!): Boolean
}

type Mutation {
	signUp(input: SignUpInput!): User
	rate(score: Float! @constraint(multipleOf: 0.5), ids: [ID!]! @constraint(minItems: 1, minLength: 3)): Boolean
}
`;

export const schema = buildSchema(sdl);

export const documents = [
	{
		location: 'operations.graphql',
		document: parse(`
			mutation SignUp($input: SignUpInput!) { signUp(input: $input) { ...UserFields } }
			query User($id: ID!) { user(id: $id) { ...UserFields } }
			fragment UserFields on User { id name }
			query Users($name: String, $first: Int = 5) {
				users(filter: { and: [{ name: $name }] }, first: $first) { id }
			}
			mutation Rate($score: Float!, $id: ID!) { rate(score: $score, ids: [$id]) }
			query Reach($c: Contact!) { reach(contact: $c) }
			query ReachEmail($e: String!) { reach(contact: { email: $e }) }
		`),
	},
	// No name, so no schema: it is skipped, not an error.
	{ location: 'anonymous.graphql', document: parse('query { users { id } }') },
];
