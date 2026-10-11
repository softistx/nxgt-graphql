/**
 * A value as graphql-js prints it in an error message (`inspect`, as
 * `@graphql-tools/executor` takes it from `cross-inspect`): a string
 * quoted, `{ a: 1, b: "x" }`, `[1, 2]`, `{}` and `[]`, and `[Object]` or
 * `[Array]` beyond three levels. The variables come from JSON, so no
 * function, error or cycle reaches it.
 */
export function inspect(value: unknown): string {
	return formatValue(value, 0);
}

const MAX_DEPTH = 3;

function formatValue(value: unknown, depth: number): string {
	if (typeof value === 'string') return JSON.stringify(value);
	if (typeof value !== 'object' || value === null) return String(value);
	if (Array.isArray(value)) {
		if (value.length === 0) return '[]';
		if (depth >= MAX_DEPTH) return '[Array]';
		return `[${value.map((item) => formatValue(item, depth + 1)).join(', ')}]`;
	}
	const entries = Object.entries(value);
	if (entries.length === 0) return '{}';
	if (depth >= MAX_DEPTH) return '[Object]';
	return `{ ${entries
		.map(([key, item]) => `${key}: ${formatValue(item, depth + 1)}`)
		.join(', ')} }`;
}
