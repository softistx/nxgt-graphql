import { z } from 'zod';

/**
 * Whether the last label of `name` (a trailing dot aside) is a number, as a
 * WHATWG URL parser reads it: all digits, or `0x` and hex digits. Such a
 * host is parsed as an IPv4 address (`https://123`, `https://a.0x7f`), so it
 * is never a host name (RFC 1123, 2.1).
 */
export function endsInNumber(name: string): boolean {
	const labels = name.replace(/\.$/, '').split('.');
	return /^(?:\d+|0[xX][0-9a-fA-F]*)$/.test(labels.at(-1) ?? '');
}

/**
 * Whether `name` is a host name: Zod's pattern (dot-separated labels of
 * letters, digits and hyphens, none starting or ending with a hyphen, each
 * up to 63 characters, 253 in all, an optional trailing dot), and a last
 * label that is not a number ({@link endsInNumber}).
 */
export function isHostname(name: string): boolean {
	return z.regexes.hostname.test(name) && !endsInNumber(name);
}
