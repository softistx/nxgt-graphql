/*!
 * Ported from cross-inspect 1.0.1 (packages/inspect),
 * https://github.com/ardatan/graphql-tools
 * Copyright (c) 2020 The Guild, Inc.
 * itself taken from graphql-js, https://github.com/graphql/graphql-js
 * Copyright (c) GraphQL Contributors
 * @license MIT
 */

/**
 * A value as @graphql-tools/executor prints it in the messages it words
 * itself (the input objects' and the variable's prefix), through
 * `cross-inspect`: a string quoted, `{ a: 1, b: "x" }`, `[1, 2]`, `{}` and
 * `[]`, `[Object]` or `[Array]` beyond three levels, and every item of a
 * list. The variables come from JSON, so no function, error or cycle
 * reaches it: those branches of cross-inspect are left out. graphql's own
 * messages print with graphql's `inspect` (`inspect.ts`).
 */
export function crossInspect(value: unknown): string {
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
