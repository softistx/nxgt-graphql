import { describe, expect, test } from 'bun:test';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { Kind, parse, visit } from 'graphql';
import { constraintTypeDefs } from './constraint-directive';

const NAMED = new Set<string>([
	Kind.OBJECT_TYPE_DEFINITION,
	Kind.INTERFACE_TYPE_DEFINITION,
	Kind.INPUT_OBJECT_TYPE_DEFINITION,
	Kind.ENUM_TYPE_DEFINITION,
	Kind.UNION_TYPE_DEFINITION,
	Kind.SCALAR_TYPE_DEFINITION,
	Kind.DIRECTIVE_DEFINITION,
	Kind.FIELD_DEFINITION,
	Kind.INPUT_VALUE_DEFINITION,
	Kind.ENUM_VALUE_DEFINITION,
]);

/**
 * The coordinates (`Type.field.arg`, `directive.arg`) of every SDL element
 * without a description. A package's SDL is the only documentation an agent
 * reading the schema gets.
 */
function undescribed(sdl: string): string[] {
	const missing: string[] = [];
	const path: string[] = [];
	visit(parse(sdl), {
		enter(node) {
			if (!NAMED.has(node.kind) || !('name' in node) || !node.name) return;
			path.push(node.name.value);
			if (!('description' in node) || !node.description?.value.trim())
				missing.push(path.join('.'));
		},
		leave(node) {
			if (NAMED.has(node.kind) && 'name' in node && node.name) path.pop();
		},
	});
	return missing;
}

describe('the shipped SDL is documented', () => {
	test('the checker reports an undescribed directive and argument', () => {
		expect(undescribed('directive @a(b: Int) on FIELD_DEFINITION')).toEqual([
			'a',
			'a.b',
		]);
	});

	test('constraintTypeDefs describes the directive and every argument', () => {
		expect(undescribed(constraintTypeDefs)).toEqual([]);
	});

	test('graphql/constraint.graphqls describes the directive and every argument', async () => {
		const file = await readFile(
			join(import.meta.dir, '../graphql/constraint.graphqls'),
			'utf8',
		);
		expect(undescribed(file)).toEqual([]);
	});
});
