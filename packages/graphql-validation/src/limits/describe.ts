import type { OperationDefinitionNode } from 'graphql';

/** `Operation "Name"`, or `Operation` for an anonymous one. */
export function operationLabel(operation: OperationDefinitionNode): string {
	return operation.name ? `Operation "${operation.name.value}"` : 'Operation';
}

/** Throws a `RangeError` unless `value` is an integer of at least `min`. */
export function assertInteger(
	option: string,
	value: number,
	min: number,
): void {
	if (!Number.isInteger(value) || value < min) {
		throw new RangeError(`${option} must be an integer of at least ${min}.`);
	}
}
