import type { ValueNode } from 'graphql';
import { CEILING } from './describe';

const CANONICAL_INTEGER = /^(0|[1-9]\d*)$/;

/**
 * The one reading of a size, wherever it comes from (a literal, a default): a
 * non-negative integral number or bigint, or a canonical-integer string,
 * clamped to the ceiling. Anything else says nothing.
 */
export function sizeOf(value: unknown): number | undefined {
	if (typeof value === 'string') {
		return CANONICAL_INTEGER.test(value)
			? Math.min(Number(value), CEILING)
			: undefined;
	}
	// A bigint is how a Long scalar's default is held once its real scalar is
	// swapped in.
	if (typeof value === 'bigint') {
		return value >= 0n ? Math.min(Number(value), CEILING) : undefined;
	}
	return typeof value === 'number' && Number.isInteger(value) && value >= 0
		? Math.min(value, CEILING)
		: undefined;
}

/** The size a literal gives: an Int, a canonical-integer String or an integral Float (`1e3`). */
export function literalSize(value: ValueNode): number | undefined {
	if (value.kind === 'IntValue' || value.kind === 'FloatValue') {
		return sizeOf(Number(value.value));
	}
	return value.kind === 'StringValue' ? sizeOf(value.value) : undefined;
}

/**
 * An argument's SDL default as a size. graphql 16 holds it as `defaultValue`;
 * graphql 17 as `default`, `{ value }` or `{ literal }`.
 */
export function defaultSizeOf(
	argument: object | undefined,
): number | undefined {
	if (!argument) return undefined;
	if ('defaultValue' in argument) {
		const size = sizeOf(argument.defaultValue);
		if (size !== undefined) return size;
	}
	if (!('default' in argument)) return undefined;
	const fallback = argument.default;
	if (typeof fallback !== 'object' || fallback === null) return undefined;
	if ('value' in fallback) return sizeOf(fallback.value);
	if ('literal' in fallback && typeof fallback.literal === 'object') {
		const literal = fallback.literal;
		return literal !== null && 'kind' in literal
			? literalSize(literal as ValueNode)
			: undefined;
	}
	return undefined;
}
