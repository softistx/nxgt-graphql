import type { FieldNode, SelectionSetNode } from 'graphql';
import { Dependencies } from './changes';
import { fieldKey } from './field-key';
import {
	collectFields,
	type Definitions,
	subSelections,
	type Walk,
} from './selection';
import type { EntityStore } from './store';
import {
	deepMerge,
	isPlainObject,
	isReference,
	type StoreObject,
} from './values';

interface Reader extends Walk<Definitions> {
	readonly store: EntityStore;
	readonly deps: Dependencies;
}

/** Marks a read that met a missing field or entity. */
const missing: unique symbol = Symbol('missing');
type Missing = typeof missing;

/** An operation's result from the store, or `undefined`, and every field the read used. */
export interface ReadResult {
	readonly data: StoreObject | undefined;
	readonly deps: Dependencies;
}

/**
 * Denormalizes an operation's result from the store, by its selection:
 * fragments, aliases, arguments and `@skip`/`@include` applied. The result
 * is a fresh object; any field missing makes it `undefined`.
 */
export function readResult(walk: Walk, store: EntityStore): ReadResult {
	const { rootKey, operation } = walk.document;
	return readEntity(walk, store, rootKey, operation.selectionSet);
}

/** One entity read through a selection set: an operation's root, or a fragment's entity. */
export function readEntity(
	walk: Walk<Definitions>,
	store: EntityStore,
	key: string,
	set: SelectionSetNode,
): ReadResult {
	const reader: Reader = { ...walk, store, deps: new Dependencies() };
	reader.deps.entity(key);
	const source = store.get(key);
	if (!source) return { data: undefined, deps: reader.deps };
	const data = readObject(reader, source, key, [set]);
	return { data: data === missing ? undefined : data, deps: reader.deps };
}

/** `entity` is the source's key when it is an entity, `undefined` when embedded. */
function readObject(
	reader: Reader,
	source: StoreObject,
	entity: string | undefined,
	sets: readonly SelectionSetNode[],
): StoreObject | Missing {
	const typename = source['__typename'];
	const { fields, undecided } = collectFields(
		sets,
		typeof typename === 'string' ? typename : undefined,
		reader,
		false,
	);
	const result: StoreObject = {};
	for (const [responseKey, nodes] of fields) {
		const key = fieldKey(nodes[0] as FieldNode, reader.variables);
		if (entity !== undefined) reader.deps.field(entity, key);
		if (!Object.hasOwn(source, key)) return missing;
		const value = readValue(reader, source[key], subSelections(nodes));
		if (value === missing) return missing;
		result[responseKey] = value;
	}
	// A fragment on an abstract type with no possibleTypes: kept when whole.
	for (const set of undecided) {
		const extra = readObject(reader, source, entity, [set]);
		if (extra !== missing) deepMerge(result, extra);
	}
	return result;
}

function readValue(
	reader: Reader,
	value: unknown,
	sets: readonly SelectionSetNode[],
): unknown {
	if (value === null || typeof value !== 'object') return value;
	if (sets.length === 0) return structuredClone(value);
	if (Array.isArray(value)) {
		const items = value.map((item) => readValue(reader, item, sets));
		return items.includes(missing) ? missing : items;
	}
	if (isReference(value)) {
		reader.deps.entity(value.__ref);
		const target = reader.store.get(value.__ref);
		if (!target) return missing;
		return readObject(reader, target, value.__ref, sets);
	}
	if (isPlainObject(value)) return readObject(reader, value, undefined, sets);
	return value;
}
