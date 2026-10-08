import {
	type Constraint,
	constraintsOn,
} from '@nxgt/graphql-validation/codegen';
import {
	type ASTNode,
	type FragmentDefinitionNode,
	type GraphQLDirective,
	type GraphQLInputType,
	type GraphQLSchema,
	getNamedType,
	isInputObjectType,
	isListType,
	isNonNullType,
	Kind,
	type OperationDefinitionNode,
	TypeInfo,
	typeFromAST,
	type ValueNode,
	visit,
	visitWithTypeInfo,
} from 'graphql';
import type { DocumentFile } from './index';
import type { Naming } from './naming';
import { declare } from './schema-output';
import { objectMembers, type Writer } from './writer';

/**
 * One schema per named operation in `documents`, for its variables as a
 * client sends them (`z.input`). A variable gets the constraints of every
 * argument or input field it is passed to, in the operation and in the
 * fragments it spreads: the client refuses what the server would.
 * An anonymous operation has no name to give its schema, and gets none.
 */
export function variablesBlocks(
	schema: GraphQLSchema,
	documents: readonly DocumentFile[],
	writer: Writer,
	naming: Naming,
): string[] {
	const definitions = documents.flatMap(
		(file) => file.document?.definitions ?? [],
	);
	const fragments = new Map(
		definitions
			.filter(
				(node): node is FragmentDefinitionNode =>
					node.kind === Kind.FRAGMENT_DEFINITION,
			)
			.map((node) => [node.name.value, node]),
	);
	return definitions
		.filter(
			(node): node is OperationDefinitionNode =>
				node.kind === Kind.OPERATION_DEFINITION,
		)
		.flatMap((operation) => {
			const operationName = operation.name?.value;
			if (!operationName) return [];
			const used = usages(schema, writer.directive, operation, fragments);
			const members = (operation.variableDefinitions ?? []).map(
				(definition) => {
					const variable = definition.variable.name.value;
					const type = typeFromAST(schema, definition.type) as
						| GraphQLInputType
						| undefined;
					if (!type) {
						throw new Error(
							`@nxgt/graphql-codegen-zod: ${operationName}'s $${variable} has a type the schema does not define.`,
						);
					}
					const where = `${operationName}($${variable}:)`;
					const constraints = merged(used.get(variable) ?? [], where);
					return [
						variable,
						writer.value(type, constraints, where, definition.defaultValue),
					] as const;
				},
			);
			return [
				declare(
					naming.variables(operationName, operation.operation),
					naming,
					`z.object({\n${objectMembers(members)}\n})`,
					'input',
				),
			];
		});
}

/** One place a variable is passed to, and the constraints written there. */
interface Usage {
	readonly where: string;
	readonly constraints: readonly Constraint[];
}

/** Where a walk of an operation stands: what it found, what it reads. */
interface Walk {
	readonly found: Map<string, Usage[]>;
	readonly variables: ReadonlySet<string>;
	readonly directive: GraphQLDirective | undefined;
}

/** Each variable's usages, in the operation and the fragments it spreads. */
function usages(
	schema: GraphQLSchema,
	directive: GraphQLDirective | undefined,
	operation: OperationDefinitionNode,
	fragments: ReadonlyMap<string, FragmentDefinitionNode>,
): Map<string, Usage[]> {
	const walk: Walk = {
		found: new Map(),
		variables: new Set(
			(operation.variableDefinitions ?? []).map((d) => d.variable.name.value),
		),
		directive,
	};
	const seen = new Set<string>();
	const visitNode = (node: ASTNode): void => {
		const typeInfo = new TypeInfo(schema);
		visit(
			node,
			visitWithTypeInfo(typeInfo, {
				Argument(argument) {
					const definition = typeInfo.getArgument();
					const field = typeInfo.getFieldDef();
					// A directive's argument carries no constraint (withValidation refuses one).
					if (!definition || !field || typeInfo.getDirective() !== null) return;
					const where = `${typeInfo.getParentType()?.name}.${field.name}(${definition.name}:)`;
					walkValue(
						walk,
						argument.value,
						definition.type,
						constraintsOn(directive, definition.astNode),
						where,
					);
				},
				FragmentSpread(spread) {
					const fragment = fragments.get(spread.name.value);
					if (fragment && !seen.has(fragment.name.value)) {
						seen.add(fragment.name.value);
						visitNode(fragment);
					}
				},
			}),
		);
	};
	visitNode(operation);
	return walk.found;
}

/**
 * Records the variables inside a value passed where `type` is expected:
 * the value itself, the items of a list literal (which take the items'
 * rules), the fields of an object literal (which take their own).
 */
function walkValue(
	walk: Walk,
	value: ValueNode,
	type: GraphQLInputType,
	constraints: readonly Constraint[],
	where: string,
): void {
	if (value.kind === Kind.VARIABLE) {
		if (!walk.variables.has(value.name.value)) return;
		const list = walk.found.get(value.name.value) ?? [];
		list.push({ where, constraints });
		walk.found.set(value.name.value, list);
		return;
	}
	const nullable = isNonNullType(type) ? type.ofType : type;
	if (value.kind === Kind.LIST && isListType(nullable)) {
		const items = constraints.filter(({ rule }) => rule.target !== 'list');
		for (const item of value.values)
			walkValue(walk, item, nullable.ofType, items, where);
		return;
	}
	const named = getNamedType(type);
	if (value.kind === Kind.OBJECT && isInputObjectType(named)) {
		for (const field of value.fields) {
			const definition = named.getFields()[field.name.value];
			if (definition) {
				walkValue(
					walk,
					field.value,
					definition.type,
					constraintsOn(walk.directive, definition.astNode),
					`${named.name}.${definition.name}`,
				);
			}
		}
	}
}

/**
 * Every constraint of every usage, once each, `format` first. Two
 * different formats cannot both be written (each replaces the schema), so
 * they fail generation, naming both places.
 */
function merged(usages: readonly Usage[], where: string): Constraint[] {
	const all: (Constraint & { readonly at: string })[] = [];
	for (const usage of usages) {
		for (const constraint of usage.constraints) {
			const same = all.some(
				(known) =>
					known.rule === constraint.rule && known.value === constraint.value,
			);
			if (!same) all.push({ ...constraint, at: usage.where });
		}
	}
	const bases = all.filter(({ rule }) => rule.base);
	const [first, second] = bases;
	if (first && second) {
		throw new Error(
			`@nxgt/graphql-codegen-zod: ${where} is passed to ${first.at} (${first.rule.argument}: ${JSON.stringify(first.value)}) and to ${second.at} (${second.rule.argument}: ${JSON.stringify(second.value)}), whose schemas cannot both apply. Use one variable for each.`,
		);
	}
	return [...bases, ...all.filter(({ rule }) => !rule.base)].map(
		({ rule, value }) => ({ rule, value }),
	);
}
