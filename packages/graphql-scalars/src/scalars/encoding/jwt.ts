import { z } from 'zod';
import { decodeBase64Url } from '../../rules/base64';
import { zodScalar } from '../../zod-scalar';

/** The JSON object a base64url part holds, or `undefined`. */
function jsonObjectOf(part: string): Record<string, unknown> | undefined {
	const binary = decodeBase64Url(part);
	if (binary === undefined) return undefined;
	try {
		const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
		const value: unknown = JSON.parse(
			new TextDecoder('utf-8', { fatal: true }).decode(bytes),
		);
		return typeof value === 'object' && value !== null && !Array.isArray(value)
			? (value as Record<string, unknown>)
			: undefined;
	} catch {
		return undefined;
	}
}

/**
 * A signed JWT in compact form (RFC 7519, RFC 7515): three base64url parts,
 * a header and a payload that are JSON objects, a signature that is not
 * empty, and a header `alg` that is a string and not `none`, in any case. An
 * unsecured token is never one, even with a signature (RFC 7518, 3.6).
 */
function isSignedJwt(token: string): boolean {
	const parts = token.split('.');
	if (parts.length !== 3) return false;
	const [header, payload, signature] = parts as [string, string, string];
	if (signature === '' || decodeBase64Url(signature) === undefined) {
		return false;
	}
	const fields = jsonObjectOf(header);
	if (fields === undefined || jsonObjectOf(payload) === undefined) return false;
	const { alg } = fields;
	return typeof alg === 'string' && alg.toLowerCase() !== 'none';
}

/**
 * A JSON Web Token in compact form, signed: see {@link isSignedJwt}. Only its
 * shape is checked: verify the signature in your application.
 */
export const jwtSchema = z
	.string()
	.refine(isSignedJwt, { error: 'Invalid JWT' });

export const JWTScalar = zodScalar(jwtSchema, {
	name: 'JWT',
	description:
		'A signed JSON Web Token in compact form. Its signature is not verified.',
	specifiedByURL: 'https://www.rfc-editor.org/rfc/rfc7519',
});
