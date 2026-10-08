import { z } from 'zod';
import { isHostname } from '../../rules/hostname';
import { zodScalar } from '../../zod-scalar';

/**
 * Zod's `z.email()` pattern for the local part, the domain left to
 * {@link hasHostDomain}: Zod's own domain part takes a label past 63
 * characters or ending in `-`, and no `xn--` top-level label.
 */
const pattern = /^(?:[A-Za-z0-9_'+-]+\.)*[A-Za-z0-9_'+-]*[A-Za-z0-9_+-]@[^@]+$/;

/**
 * Whether the domain after the `@` is a host name as `Hostname` takes it,
 * with at least two labels, the last one letters or `xn--`.
 */
function hasHostDomain(address: string): boolean {
	const domain = address.slice(address.indexOf('@') + 1);
	const top = domain.slice(domain.lastIndexOf('.') + 1);
	return (
		isHostname(domain) &&
		domain.includes('.') &&
		// A top-level domain is letters, or an IDN's `xn--` form: `.c0m` is
		// a typo, as Zod's own domain part says.
		/^(?:[A-Za-z]{2,}|xn--[A-Za-z0-9-]+)$/.test(top)
	);
}

/**
 * An email address: a local part as Zod's `z.email()` takes it (letters,
 * digits, `_`, `'`, `+`, `-`, and dots between them; no quoted form), `@`,
 * then a domain of at least two labels that follows `Hostname`'s rule,
 * its last label letters or `xn--` (`u@x.xn--p1ai`, not `u@a-.com` or
 * `u@x.c0m`). Any case, kept as sent. Only its shape
 * is checked: whether it receives mail is not.
 */
export const emailAddressSchema = z
	.email({ pattern })
	.refine(hasHostDomain, { error: 'Invalid email address' });

export const EmailAddressScalar = zodScalar(emailAddressSchema, {
	name: 'EmailAddress',
	description: 'An email address.',
});
