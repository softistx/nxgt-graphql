import { useRef } from 'react';
import { stableJson } from '../cache/field-key';

/**
 * The value of the render that first had this key: a new object literal
 * with the same content is the same value, so an effect depending on it
 * does not run again.
 */
export function useStable<T>(value: T, key: string): T {
	const ref = useRef({ key, value });
	if (ref.current.key !== key) ref.current = { key, value };
	return ref.current.value;
}

/** Variables by value: their JSON, object keys sorted. */
export function variablesKey(variables: unknown): string {
	return stableJson(variables ?? {});
}

/** Headers by value: their names lowercased, in order. */
export function headersKey(headers: HeadersInit | undefined): string {
	return headers === undefined ? '' : JSON.stringify([...new Headers(headers)]);
}
