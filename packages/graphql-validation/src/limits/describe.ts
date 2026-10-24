import type { OperationDefinitionNode } from 'graphql';

/** Costs and counts are plain numbers, held below this so a hostile query never reaches `Infinity`. */
export const CEILING = Number.MAX_SAFE_INTEGER;

/** `a + b`, clamped where a number stops being exact. */
export const add = (a: number, b: number) => Math.min(CEILING, a + b);

/** `Operation "Name"`, or `Operation` for an anonymous one. */
export function operationLabel(operation: OperationDefinitionNode): string {
	return operation.name ? `Operation "${operation.name.value}"` : 'Operation';
}

/**
 * Throws a `RangeError` unless `value` is an integer from `min` up to, and
 * excluding, `max` (default: `Number.MAX_SAFE_INTEGER`, where a cost is clamped).
 */
export function assertInteger(
	option: string,
	value: number,
	min: number,
	max = CEILING,
): void {
	if (!Number.isInteger(value) || value < min || value >= max) {
		throw new RangeError(
			`${option} must be an integer from ${min} to ${max - 1}.`,
		);
	}
}
