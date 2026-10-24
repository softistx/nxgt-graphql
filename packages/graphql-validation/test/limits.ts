import type { ValidationRule } from 'graphql';
import { buildSchema, parse, specifiedRules, validate } from 'graphql';

/** The schema of the issue: a list cycle, `Folder.items` and `Item.folder`. */
export const cycleSchema = buildSchema(/* GraphQL */ `
	type Folder {
		id: ID!
		items(first: Int = 100): [Item!]!
	}
	type Item {
		id: ID!
		folder: Folder!
	}
	type Query {
		folder(id: ID!): Folder
	}
`);

/** The issue's query: four `items` levels, a hundred each by default. */
export const cycleQuery = /* GraphQL */ `
	query {
		folder(id: "1") {
			items { folder { items { folder { items { folder { items { id } } } } } } }
		}
	}
`;

/** Validates `source` against `schema` with graphql's own rules and `rules`. */
export function check(
	source: string,
	rules: ValidationRule[],
	schema = cycleSchema,
) {
	return validate(schema, parse(source), [...specifiedRules, ...rules]);
}

/** What the limit rules put in a refusal's `extensions`. */
export interface LimitExtensions {
	code?: string;
	depth?: number;
	cost?: number;
	limit?: number;
}

/** A refusal's `extensions`, typed. */
export function limitOf(error: { extensions?: unknown } | undefined) {
	return (error?.extensions ?? {}) as LimitExtensions;
}
