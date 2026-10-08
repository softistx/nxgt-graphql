/**
 * Whether `value` is the one spelling of its bytes: decoding then encoding it
 * gives it back. A last character with unused bits set (`YR==` for `YQ==`)
 * decodes to the same bytes, so it is a second spelling and refused.
 * `atob` and `btoa` are in every runtime this package supports.
 */
export function isCanonicalBase64(value: string): boolean {
	try {
		return btoa(atob(value)) === value;
	} catch {
		return false;
	}
}

/**
 * The binary string a base64url value holds (each character one byte), or
 * `undefined` when it is not base64url in its one spelling: no padding, and
 * encoding the bytes again gives the value back (`YR` for `YQ` is refused).
 */
export function decodeBase64Url(value: string): string | undefined {
	if (!/^[A-Za-z0-9_-]*$/.test(value)) return undefined;
	try {
		const bytes = atob(value.replaceAll('-', '+').replaceAll('_', '/'));
		const back = btoa(bytes)
			.replaceAll('+', '-')
			.replaceAll('/', '_')
			.replace(/=+$/, '');
		return back === value ? bytes : undefined;
	} catch {
		return undefined;
	}
}

/** Whether `value` is base64url in its one spelling: see {@link decodeBase64Url}. */
export function isCanonicalBase64Url(value: string): boolean {
	return decodeBase64Url(value) !== undefined;
}
