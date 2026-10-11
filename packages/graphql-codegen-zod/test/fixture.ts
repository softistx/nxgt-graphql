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
	dates: [DateTime!]
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
	contacts: [Contact!] @constraint(maxItems: 2)
	"The application's own formats: from the formatSchemas record, then zodFormats."
	handle: String = "new-user" @constraint(format: "slug", maxLength: 12)
	country: String @constraint(format: "country-code")
	skus: [String!] @constraint(format: "sku", maxItems: 2)
}

input Contact @oneOf {
	email: String @constraint(format: "email")
	phone: String @constraint(minLength: 6)
}

"""A group, whose members are people or groups: a cycle through a @oneOf."""
input Group {
	name: String! @constraint(minLength: 2)
	members: [Member!] @constraint(maxItems: 5)
	role: Role = USER
	since: DateTime
}

input Member @oneOf {
	person: String @constraint(minLength: 2)
	group: Group
}

"""Someone with an account."""
type User implements Node {
	id: ID!
	name: String!
	role: Role
	"Who they follow."
	friends: [User!]
	pinned: SearchResult
	joined: DateTime!
}

type Post implements Node {
	id: ID!
	title: String!
	author: User!
	tags: [[String]]
}

union SearchResult = User | Post

# Edge cases: one member, none, an interface implementing another, a root
# type returned by a field, and a loop longer than TypeScript infers (TS2589
# past ten).
# An input named as the usual SDL names it, beside the cyclic User.
input UserInput { name: String }
union Solo = User
interface Lonely { id: ID! }
interface Named implements Node { id: ID!, name: String! }
type SignUpPayload { query: Query! }
type Ring0 { next: Ring1! }
type Ring1 { next: Ring2! }
type Ring2 { next: Ring3! }
type Ring3 { next: Ring4! }
type Ring4 { next: Ring5! }
type Ring5 { next: Ring6! }
type Ring6 { next: Ring7! }
type Ring7 { next: Ring8! }
type Ring8 { next: Ring9! }
type Ring9 { next: Ring10! }
type Ring10 { next: Ring11! }
type Ring11 { next: Ring0! }

interface Node { id: ID! }

type Query {
	user("At least three characters." id: ID! @constraint(minLength: 3)): User
	users(filter: Filter, first: Int = 10 @constraint(min: 1, max: 50)): [User!]!
	reach(contact: Contact!): Boolean
	groups(where: Group): Boolean
	search(text: String!): [SearchResult!]!
	node(id: ID!): Node
	log(at: [DateTime]!, groups: [Group]!, nested: [[Group]!]): Boolean
}

type Mutation {
	signUp(input: SignUpInput!): User
	rate(score: Float! @constraint(multipleOf: 0.5), ids: [ID!]! @constraint(minItems: 1, minLength: 3)): Boolean
	order(sku: String! @constraint(format: "sku")): Boolean
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
			mutation Order($sku: String!) { order(sku: $sku) }
			query Reach($c: Contact!) { reach(contact: $c) }
			query ReachEmail($e: String!) { reach(contact: { email: $e }) }
			query Groups($where: Group) { groups(where: $where) }
			query Log($at: [DateTime]!, $groups: [Group]!, $nested: [[Group]!]) {
				log(at: $at, groups: $groups, nested: $nested)
			}
			query Search($text: String!, $id: ID!, $withTags: Boolean!) {
				search(text: $text) {
					__typename
					... on User { id who: name joined role }
					... on Post { id title tags @include(if: $withTags) author { ...UserFields } }
				}
				node(id: $id) { __typename id kind: __typename }
			}
			fragment Pinned on User { pinned { __typename ... on Post { title } } }
			query PinnedUser($id: ID!) { user(id: $id) { id ...Pinned } }
			query Friends($id: ID!, $v: Boolean!) {
				user(id: $id) { friends { id } friends @include(if: $v) { name } }
				node(id: $id) { id ...UserName @include(if: $v) __typename }
				plain: node(id: $id) { id }
				maybe: user(id: $id) @include(if: $v) { id }
			}
			fragment UserName on User { name }
			# Past what TypeScript infers in one z.object (TS2589 at 14).
			query Deep($id: ID!) { user(id: $id) { friends { friends { friends { friends { friends { friends { friends { friends { friends { friends { friends { friends { friends { friends { friends { friends { id } } } } } } } } } } } } } } } } } }
		`),
	},
	// No name, so no schema: it is skipped, not an error.
	{ location: 'anonymous.graphql', document: parse('query { users { id } }') },
];
