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

/** JSON whose object keys are sorted, at every depth. */
export function stableJson(value: unknown): string {
	if (Array.isArray(value))
		return `[${value.map((item) => (item === undefined ? 'null' : stableJson(item))).join(',')}]`;
	if (typeof value === 'object' && value !== null) {
		const record = value as Record<string, unknown>;
		const entries = Object.keys(record)
			.filter((key) => record[key] !== undefined)
			.sort()
			.map((key) => `${JSON.stringify(key)}:${stableJson(record[key])}`);
		return `{${entries.join(',')}}`;
	}
	return JSON.stringify(value) ?? 'null';
}
