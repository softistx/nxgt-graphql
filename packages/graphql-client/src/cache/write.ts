import type { FieldNode, SelectionSetNode } from 'graphql';
import { fieldKey } from './field-key';
import { identify } from './identity';
import { collectFields, subSelections, type Walk } from './selection';
import type { EntityStore } from './store';
import type { CacheKeys } from './types';
import { isPlainObject, isReference, type StoreObject } from './values';

interface Writer extends Walk {
	readonly store: EntityStore;
	readonly keys: CacheKeys | undefined;
}

/**
 * Normalizes an operation's data into the store: each object with an
 * identity becomes an entity, merged field by field into what the store
 * held; the others are stored inside their parent. A query's root fields
 * are kept under its root key; a mutation's and a subscription's are not
 * (their arguments may hold secrets), only the entities they return.
 */
export function writeResult(writer: Writer, data: unknown): void {
	if (!isPlainObject(data))
		throw new TypeError("The cache stores an operation's data: an object");
	const { operation, rootKey } = writer.document;
	const isQuery = operation.operation === 'query';
	const previous = isQuery ? writer.store.get(rootKey) : undefined;
	const { fields } = collectFields(
		[operation.selectionSet],
		undefined,
		writer,
		true,
	);
	const entries = writeFields(writer, data, fields, previous);
	if (isQuery) writer.store.merge(rootKey, entries);
}

function writeObject(
	writer: Writer,
	data: StoreObject,
	sets: readonly SelectionSetNode[],
	existing: unknown,
): unknown {
	const typename = data['__typename'];
	const { fields } = collectFields(
		sets,
		typeof typename === 'string' ? typename : undefined,
		writer,
		true,
	);
	const key = identify(byName(data, fields), writer.keys);
	if (key) {
		const entries = writeFields(writer, data, fields, writer.store.get(key));
		writer.store.merge(key, entries);
		return { __ref: key };
	}
	// Embedded: merged over what the same field held for the same type, so
	// two queries selecting different fields of it both stay whole.
	const previous =
		isPlainObject(existing) &&
		!isReference(existing) &&
		existing['__typename'] === typename
			? existing
			: undefined;
	const entries = writeFields(writer, data, fields, previous);
	return previous ? { ...previous, ...entries } : entries;
}

function writeFields(
	writer: Writer,
	data: StoreObject,
	fields: ReadonlyMap<string, FieldNode[]>,
	previous: StoreObject | undefined,
): StoreObject {
	const entries: StoreObject = {};
	for (const [responseKey, nodes] of fields) {
		if (!Object.hasOwn(data, responseKey)) continue;
		const key = fieldKey(nodes[0] as FieldNode, writer.variables);
		const sets = subSelections(nodes);
		entries[key] = writeValue(writer, data[responseKey], sets, previous?.[key]);
	}
	return entries;
}

function writeValue(
	writer: Writer,
	value: unknown,
	sets: readonly SelectionSetNode[],
	existing: unknown,
): unknown {
	if (value === undefined || value === null) return null;
	// A leaf: a scalar's value, a JSON one included, kept as it came.
	if (sets.length === 0) return structuredClone(value);
	if (Array.isArray(value))
		return value.map((item) => writeValue(writer, item, sets, undefined));
	if (!isPlainObject(value)) return value;
	return writeObject(writer, value, sets, existing);
}

/** The object's argument-less fields by their names, aliases resolved: what `keys` reads. */
function byName(
	data: StoreObject,
	fields: ReadonlyMap<string, FieldNode[]>,
): Record<string, unknown> {
	const named: Record<string, unknown> = {};
	for (const [responseKey, [node]] of fields) {
		if (!node || node.arguments?.length || !Object.hasOwn(data, responseKey))
			continue;
		const name = node.name.value;
		if (!Object.hasOwn(named, name)) named[name] = data[responseKey];
	}
	return named;
}
