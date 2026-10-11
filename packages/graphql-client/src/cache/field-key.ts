import { type FieldNode, valueFromASTUntyped } from 'graphql';

/** An operation's variables, its defaults applied. */
export type Variables = Readonly<Record<string, unknown>>;

/**
 * Where a field is stored: its name, and its arguments when it has any,
 * keys sorted, so `book(id: 1)` and `book(id: $id)` with `id: 1` share a key:
 * `book({"id":1})`. An alias never reaches the key.
 */
export function fieldKey(field: FieldNode, variables: Variables): string {
	const name = field.name.value;
	if (!field.arguments?.length) return name;
	const args: Record<string, unknown> = {};
	for (const argument of field.arguments) {
		const value = valueFromASTUntyped(argument.value, variables);
		if (value !== undefined) args[argument.name.value] = value;
	}
	if (Object.keys(args).length === 0) return name;
	return `${name}(${stableJson(args)})`;
}

/** The field's name in a field key: `book` for `book({"id":1})`. */
export function fieldNameOf(key: string): string {
	const open = key.indexOf('(');
	return open < 0 ? key : key.slice(0, open);
}

/**
 * JSON whose object keys are sorted, at every depth, written as
 * `JSON.stringify` writes it otherwise: `toJSON` is honoured (a `Date` is its
 * ISO string), and a value JSON leaves out (`undefined`, a function) is left
 * out of an object and `null` in a list. So the key is what goes on the wire.
 */
export function stableJson(value: unknown): string {
	return written(value, '') ?? 'null';
}

function written(value: unknown, key: string): string | undefined {
	const json = hasToJson(value) ? value.toJSON(key) : value;
	if (Array.isArray(json))
		return `[${json.map((item, index) => written(item, String(index)) ?? 'null').join(',')}]`;
	if (typeof json === 'object' && json !== null) {
		const record = json as Record<string, unknown>;
		const entries: string[] = [];
		for (const name of Object.keys(record).sort()) {
			const entry = written(record[name], name);
			if (entry !== undefined) entries.push(`${JSON.stringify(name)}:${entry}`);
		}
		return `{${entries.join(',')}}`;
	}
	return JSON.stringify(json);
}

function hasToJson(value: unknown): value is { toJSON(key: string): unknown } {
	return (
		typeof value === 'object' &&
		value !== null &&
		typeof (value as { toJSON?: unknown }).toJSON === 'function'
	);
}
