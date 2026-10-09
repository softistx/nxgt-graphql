import {
	type FragmentDefinitionNode,
	type GraphQLSchema,
	isCompositeType,
	Kind,
	type OperationDefinitionNode,
} from 'graphql';
import type { DocumentFile } from './config';
import type { Naming } from './naming';
import { Selections } from './results-selections';
import { declare } from './source';
import type { Writer } from './writer';

/**
 * One schema per fragment and per named operation in `documents`, for the
 * response as it arrives: what was selected, under its alias, custom
 * scalars decoded (`z.output`). A fragment spread is inlined. An abstract
 * type's selection is one object when its possible types select the same,
 * else a union discriminated on `__typename`, which must then be selected;
 * possible types that select the same share one member, `__typename:
 * z.enum([...])`. A field under `@skip`, `@include` or `@defer` may be
 * absent. An unknown field is dropped (`z.object`).
 */
export function resultsBlocks(
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
	const selections = new Selections(schema, fragments, writer);
	const block = (
		typeName: string,
		written: { readonly hoisted: string[]; readonly code: string },
	) =>
		[
			...written.hoisted,
			declare(typeName, naming, written.code, 'output'),
		].join('\n');
	return [
		...[...fragments.values()].flatMap((fragment) => {
			const type = schema.getType(fragment.typeCondition.name.value);
			if (!isCompositeType(type)) return [];
			const typeName = naming.fragment(fragment.name.value);
			const set = { set: fragment.selectionSet, conditional: false };
			return [
				block(
					typeName,
					selections.declare(
						naming.schema(typeName),
						type,
						[set],
						`fragment ${fragment.name.value}`,
					),
				),
			];
		}),
		...definitions
			.filter(
				(node): node is OperationDefinitionNode =>
					node.kind === Kind.OPERATION_DEFINITION,
			)
			.flatMap((operation) => {
				const name = operation.name?.value;
				const root = schema.getRootType(operation.operation);
				if (!name || !root) return [];
				const typeName = naming.result(name, operation.operation);
				const set = { set: operation.selectionSet, conditional: false };
				return [
					block(
						typeName,
						selections.declare(naming.schema(typeName), root, [set], name),
					),
				];
			}),
	];
}
