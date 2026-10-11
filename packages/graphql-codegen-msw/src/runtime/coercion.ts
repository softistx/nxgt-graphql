import {
	GraphQLError,
	type GraphQLFormattedError,
	Kind,
	type OperationDefinitionNode,
	parse,
	print,
	type TypeNode,
	type VariableDefinitionNode,
} from 'graphql';
import type { z } from 'zod';
import { inspect } from './inspect';

// What graphql-yoga refuses while it coerces the variables, before any
// resolver runs: a missing or null value for a non-null type, a value of the
// wrong type, an unknown enum value, an unknown input field, an Int beyond
// 32 bits. Measured on graphql-yoga 5.24 (@graphql-tools/executor 2, graphql
// 17): one error per problem, `{ message, locations }` and no extensions,
// status 400 whatever the Accept header.

/** The status graphql-yoga answers a variable coercion error with. */
export const COERCION_STATUS = 400;

const INT_MAX = 2_147_483_647;
const INT_MIN = -2_147_483_648;

/**
 * Whether a Zod issue is one the API refuses while coercing the variables:
 * `invalid_type` (a missing, null or wrongly typed value), `invalid_value`
 * (an unknown enum value), `unrecognized_keys` (an unknown input field), a
 * number beyond Int's 32 bits, and a union whose every branch failed on one
 * of these (a list, which also takes a single item).
 */
export function isCoercionIssue(issue: z.core.$ZodIssue): boolean {
	switch (issue.code) {
		case 'invalid_type':
		case 'invalid_value':
		case 'unrecognized_keys':
			return true;
		case 'too_big':
			return issue.origin === 'number' && Number(issue.maximum) === INT_MAX;
		case 'too_small':
			return issue.origin === 'number' && Number(issue.minimum) === INT_MIN;
		case 'invalid_union':
			return (
				issue.errors.length > 0 &&
				issue.errors.every((branch) => branch.some(isCoercionIssue))
			);
		default:
			return false;
	}
}

/** What the operation's document says of its variables, when it parses. */
type Definitions = ReadonlyMap<string, VariableDefinitionNode>;

/**
 * The errors graphql-yoga answers the coercion issues among `issues` with,
 * in Zod's order: graphql-js's wording, `Variable "$id" of required type
 * "ID!" was not provided.` or `Variable "$input" got invalid value <value>
 * at "input.person"; <reason>`, each located at the variable's definition.
 * The type names come from the operation's document: a variable's own type
 * and its list items are named as the API names them; a field inside an
 * input object is not, since the mock does not hold the schema.
 */
export function coercionErrors(
	issues: readonly z.core.$ZodIssue[],
	request: {
		readonly query: string;
		readonly operationName: string;
		readonly variables: unknown;
	},
): GraphQLFormattedError[] {
	const definitions = definitionsOf(request.query, request.operationName);
	return issues
		.filter(isCoercionIssue)
		.flatMap((issue) => leaves(issue, []))
		.flatMap(({ issue, path }) =>
			describe(issue, path, request.variables, definitions).map((message) =>
				located(message, definitions.get(String(path[0]))),
			),
		);
}

/** One issue per problem: a coercion union stands for its likeliest branch. */
function leaves(
	issue: z.core.$ZodIssue,
	prefix: readonly PropertyKey[],
): { issue: z.core.$ZodIssue; path: (string | number)[] }[] {
	const path = [...prefix, ...issue.path].map((key) =>
		typeof key === 'number' ? key : String(key),
	);
	if (issue.code !== 'invalid_union') return [{ issue, path }];
	// The branch that went deepest is the one the value meant: `[1]` for a
	// list of strings fails inside the list, not as a single string.
	const branch = issue.errors
		.map((issues) => issues.filter(isCoercionIssue))
		.reduce((best, issues) => (depth(issues) > depth(best) ? issues : best));
	return branch.flatMap((inner) => leaves(inner, path));
}

function depth(issues: readonly z.core.$ZodIssue[]): number {
	return Math.max(-1, ...issues.map((issue) => issue.path.length));
}

/** The variables' definitions of the operation named `name`, by variable. */
function definitionsOf(query: string, name: string): Definitions {
	let operations: OperationDefinitionNode[];
	try {
		operations = parse(query).definitions.filter(
			(node): node is OperationDefinitionNode =>
				node.kind === Kind.OPERATION_DEFINITION,
		);
	} catch {
		return new Map();
	}
	const operation =
		operations.find((node) => node.name?.value === name) ?? operations[0];
	return new Map(
		(operation?.variableDefinitions ?? []).map((node) => [
			node.variable.name.value,
			node,
		]),
	);
}

function located(
	message: string,
	definition: VariableDefinitionNode | undefined,
): GraphQLFormattedError {
	return new GraphQLError(
		message,
		definition ? { nodes: definition } : {},
	).toJSON();
}

/** The value at `path` in `root`, or undefined. */
function valueAt(root: unknown, path: readonly (string | number)[]): unknown {
	let value = root;
	for (const key of path) {
		if (typeof value !== 'object' || value === null) return undefined;
		value = (value as Record<string | number, unknown>)[key];
	}
	return value;
}

/** The type at `path` below `type`: known through list items only. */
function typeAt(
	type: TypeNode | undefined,
	path: readonly (string | number)[],
): TypeNode | undefined {
	let current = type;
	for (const key of path) {
		const nullable =
			current?.kind === Kind.NON_NULL_TYPE ? current.type : current;
		if (typeof key !== 'number' || nullable?.kind !== Kind.LIST_TYPE)
			return undefined;
		current = nullable.type;
	}
	return current;
}

/**
 * The named type a value at `type` is coerced to: a list's item type when
 * the value is not a list, as GraphQL takes a single item for a list.
 */
function namedType(
	type: TypeNode | undefined,
	value: unknown,
): string | undefined {
	let current = type;
	while (current && current.kind !== Kind.NAMED_TYPE) {
		if (current.kind === Kind.LIST_TYPE && Array.isArray(value)) return;
		current = current.type;
	}
	return current?.name.value;
}

/** The messages one coercion issue at `path` gets, as graphql-yoga words them. */
function describe(
	issue: z.core.$ZodIssue,
	path: readonly (string | number)[],
	variables: unknown,
	definitions: Definitions,
): string[] {
	const [variable, ...inner] = path;
	if (variable === undefined) return [issue.message];
	const name = String(variable);
	const declared = definitions.get(name)?.type;
	const value = valueAt(variables, path);

	if (issue.code === 'invalid_type' && value === undefined) {
		if (inner.length === 0)
			return [
				`Variable "$${name}" of required type${quoted(declared && print(declared))} was not provided.`,
			];
		// graphql-js reports a missing field on the object that lacks it.
		const objectPath = inner.slice(0, -1);
		const object = valueAt(variables, [name, ...objectPath]);
		const type = namedType(typeAt(declared, objectPath), object);
		return [
			`${prefix(name, object, objectPath)}Expected value${ofType(type)} to include required field "${String(inner.at(-1))}", found: ${inspect(object)}.`,
		];
	}
	if (issue.code === 'invalid_type' && value === null) {
		if (inner.length === 0)
			return [
				`Variable "$${name}" of non-null type${quoted(declared && print(declared))} must not be null.`,
			];
		const type = typeAt(declared, inner);
		return [
			`${prefix(name, null, inner)}Expected value of non-null type${quoted(type && print(type))} not to be null.`,
		];
	}
	const type = namedType(typeAt(declared, inner), value);
	if (issue.code === 'unrecognized_keys')
		return issue.keys.map(
			(key) =>
				`${prefix(name, value, inner)}Expected value${ofType(type)} not to include unknown field "${key}", found: ${inspect(value)}.`,
		);
	return [`${prefix(name, value, inner)}${reason(issue, type, value)}`];
}

/** `Variable "$input" got invalid value <value> at "input.person"; ` */
function prefix(
	name: string,
	value: unknown,
	inner: readonly (string | number)[],
): string {
	const at =
		inner.length > 0
			? ` at "${name}${inner.map((key) => (typeof key === 'number' ? `[${key}]` : `.${key}`)).join('')}"`
			: '';
	return `Variable "$${name}" got invalid value ${inspect(value)}${at}; `;
}

/** Why a value of the wrong type, or not in its enum, is refused. */
function reason(
	issue: z.core.$ZodIssue,
	type: string | undefined,
	value: unknown,
): string {
	const found = inspect(value);
	if (issue.code === 'invalid_value')
		return typeof value === 'string'
			? `Value "${value}" does not exist in${type ? ` "${type}"` : ' its'} enum.`
			: `Enum${quoted(type)} cannot represent non-string value: ${found}.`;
	if (issue.code === 'too_big' || issue.code === 'too_small')
		return `Int cannot represent non 32-bit signed integer value: ${found}`;
	if (issue.code === 'invalid_type' && issue.expected === 'object')
		return `Expected value${ofType(type)} to be an object, found: ${found}.`;
	switch (type) {
		case 'String':
			return `String cannot represent a non string value: ${found}`;
		case 'ID':
			return `ID cannot represent value: ${found}`;
		case 'Int':
			return `Int cannot represent non-integer value: ${found}`;
		case 'Float':
			return `Float cannot represent non numeric value: ${found}`;
		case 'Boolean':
			return `Boolean cannot represent a non boolean value: ${found}`;
		default:
			return `Expected value ${type ? `of type "${type}"` : 'of another type'}, found: ${found}.`;
	}
}

function quoted(name: string | undefined): string {
	return name ? ` "${name}"` : '';
}

function ofType(name: string | undefined): string {
	return name ? ` of type "${name}"` : '';
}
