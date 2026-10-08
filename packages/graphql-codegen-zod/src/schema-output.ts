import { constraintsOn } from '@nxgt/graphql-validation/codegen';
import {
	type GraphQLEnumType,
	type GraphQLInputObjectType,
	type GraphQLSchema,
	isEnumType,
	isInputObjectType,
	isInterfaceType,
	isObjectType,
} from 'graphql';
import { defaultLiteral } from './defaults';
import type { Naming } from './naming';
import { declare, objectMembers } from './source';
import type { Writer } from './writer';

/**
 * The SDL's part of the file: every enum, then every input type, then the
 * arguments of every object and interface field that takes any. Types are
 * `z.output`: what a resolver receives once `withValidation` parsed them.
 */
export function schemaBlocks(
	schema: GraphQLSchema,
	writer: Writer,
	naming: Naming,
): string[] {
	const types = Object.values(schema.getTypeMap()).filter(
		(type) => !type.name.startsWith('__'),
	);
	return [
		...types.filter(isEnumType).map((type) => enumBlock(type, naming)),
		...types
			.filter(isInputObjectType)
			.map((type) => inputBlock(type, writer, naming)),
		...types.flatMap((type) => {
			if (!isObjectType(type) && !isInterfaceType(type)) return [];
			return Object.values(type.getFields())
				.filter((field) => field.args.length > 0)
				.map((field) => {
					const name = naming.args(type.name, field.name);
					const members = field.args.map(
						(arg) =>
							[
								arg.name,
								{
									...writer.value(
										arg.type,
										constraintsOn(writer.directive, arg.astNode),
										`${type.name}.${field.name}(${arg.name}:)`,
										defaultLiteral(arg),
									),
									description: arg.description,
								},
							] as const,
					);
					return declare(
						name,
						naming,
						`z.object({\n${objectMembers(members)}\n})`,
						'output',
					);
				});
		}),
	];
}

function enumBlock(type: GraphQLEnumType, naming: Naming): string {
	const values = type.getValues().map((value) => JSON.stringify(value.name));
	return declare(
		naming.type(type.name),
		naming,
		`z.enum([${values.join(', ')}])`,
		'output',
		type.description,
	);
}

function inputBlock(
	type: GraphQLInputObjectType,
	writer: Writer,
	naming: Naming,
): string {
	const fields = Object.values(type.getFields());
	const constraints = (field: (typeof fields)[number]) =>
		constraintsOn(writer.directive, field.astNode);
	const where = (field: (typeof fields)[number]) =>
		`${type.name}.${field.name}`;
	// @oneOf: exactly one member, set.
	if (type.isOneOf) {
		const members = fields.map((field) => {
			const member = {
				...writer.required(field.type, constraints(field), where(field)),
				description: field.description,
			};
			return `\tz.strictObject({\n${indent(objectMembers([[field.name, member]]))}\n\t})`;
		});
		return declare(
			naming.type(type.name),
			naming,
			`z.union([\n${members.join(',\n')},\n])`,
			'output',
			type.description,
		);
	}
	const members = fields.map(
		(field) =>
			[
				field.name,
				{
					...writer.value(
						field.type,
						constraints(field),
						where(field),
						defaultLiteral(field),
					),
					description: field.description,
				},
			] as const,
	);
	// Strict: graphql refuses a field the input type does not define.
	return declare(
		naming.type(type.name),
		naming,
		`z.strictObject({\n${objectMembers(members)}\n})`,
		'output',
		type.description,
	);
}

/** Indents each line of `code` by one tab. */
function indent(code: string): string {
	return code
		.split('\n')
		.map((line) => `\t${line}`)
		.join('\n');
}
