import type { Naming } from './naming';
import type { ValueCode } from './writer';

/** A GraphQL description as a doc comment, or nothing. */
export function docComment(
	description: string | null | undefined,
	indent = '',
): string {
	if (!description) return '';
	const lines = description
		.replaceAll('\r\n', '\n')
		.replaceAll('*/', '*\\/')
		.split('\n');
	if (lines.length === 1) return `${indent}/** ${lines[0]} */\n`;
	return `${indent}/**\n${lines.map((line) => `${indent} * ${line}`.trimEnd()).join('\n')}\n${indent} */\n`;
}

/** The members of a `z.object({...})`, a getter for each lazy one. */
export function objectMembers(
	members: readonly (readonly [string, ValueCode])[],
): string {
	return members
		.map(([name, { code, lazy, description }]) => {
			const doc = docComment(description, '\t');
			return lazy
				? `${doc}\tget ${name}() {\n\t\treturn ${code};\n\t},`
				: `${doc}\t${name}: ${code},`;
		})
		.join('\n');
}

/** `export const zX = …; export type X = z.output<typeof zX>;` */
export function declare(
	typeName: string,
	naming: Naming,
	code: string,
	side: 'input' | 'output',
	description?: string | null,
): string {
	const schemaName = naming.schema(typeName);
	const doc = docComment(description);
	return `${doc}export const ${schemaName} = ${code};\n${doc}export type ${typeName} = z.${side}<typeof ${schemaName}>;`;
}
