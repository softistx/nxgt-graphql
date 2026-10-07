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

/** The same for base64url, which has no padding and uses `-` and `_`. */
export function isCanonicalBase64Url(value: string): boolean {
	const standard = value.replaceAll('-', '+').replaceAll('_', '/');
	const padded = standard.padEnd(Math.ceil(standard.length / 4) * 4, '=');
	try {
		const back = btoa(atob(padded))
			.replaceAll('+', '-')
			.replaceAll('/', '_')
			.replace(/=+$/, '');
		return back === value;
	} catch {
		return false;
	}
}

/**
 * The binary string a base64url value holds (each character one byte), or
 * `undefined` when it is not base64url. Padding is not taken.
 */
export function decodeBase64Url(value: string): string | undefined {
	if (!/^[A-Za-z0-9_-]*$/.test(value) || value.length % 4 === 1) {
		return undefined;
	}
	const standard = value.replaceAll('-', '+').replaceAll('_', '/');
	try {
		return atob(standard.padEnd(Math.ceil(standard.length / 4) * 4, '='));
	} catch {
		return undefined;
	}
}
