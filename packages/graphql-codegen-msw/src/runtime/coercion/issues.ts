import type { z } from 'zod';

/** A Zod issue and its whole path inside the variables. */
export interface PlacedIssue {
	readonly path: readonly (string | number)[];
	readonly issue: z.core.$ZodIssue;
}

/**
 * Every issue with its whole path, a union's own issue followed by each of
 * its branches' (a list that also takes a single value is a union): a
 * custom scalar's refusal may sit in either branch.
 */
export function placed(
	issues: readonly z.core.$ZodIssue[],
	prefix: readonly (string | number)[] = [],
): PlacedIssue[] {
	return issues.flatMap((issue) => {
		const path = [...prefix, ...issue.path.map(segment)];
		const own = { path, issue };
		if (issue.code !== 'invalid_union') return [own];
		return [own, ...issue.errors.flatMap((branch) => placed(branch, path))];
	});
}

function segment(key: PropertyKey): string | number {
	return typeof key === 'number' ? key : String(key);
}

/**
 * The first issue at `path` or below it: what a custom scalar's schema
 * refused there. A scalar built with `zodScalar` refuses with its schema's
 * first issue, which the client's schema, the same one, reports first too.
 */
export function issueAt(
	issues: readonly PlacedIssue[],
	path: readonly (string | number)[],
): z.core.$ZodIssue | undefined {
	return issues.find(
		(placedIssue) =>
			placedIssue.path.length >= path.length &&
			path.every((key, index) => placedIssue.path[index] === key),
	)?.issue;
}
