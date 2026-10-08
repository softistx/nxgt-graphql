import { z } from 'zod';
import { isHostname } from '../../rules/hostname';
import { zodScalar } from '../../zod-scalar';
import { ipv4Schema } from './ipv4';
import { ipv6Schema } from './ipv6';

/**
 * Whether the host, as written, is a host name as `Hostname` takes it, an
 * IPv4 address as `IPv4` takes it, or an IPv6 address as `IPv6` takes it,
 * in brackets. A URL parser reads more (`https://123` and `https://0x7f.1`
 * as IPv4, `a_b.com` as a host): none of that is taken.
 */
function isHost(host: string): boolean {
	if (host.startsWith('[') && host.endsWith(']')) {
		return ipv6Schema.safeParse(host.slice(1, -1)).success;
	}
	return isHostname(host) || ipv4Schema.safeParse(host).success;
}

/**
 * Whether the authority — what follows `//` up to the first `/`, `?` or
 * `#` — is a host, then an optional port with no leading zero. User info
 * (`user:pass@`) is refused: credentials in a value a client may put in an
 * `href` are a leak. A `\`, which a URL parser reads as `/`, is no host's.
 */
function hasHostAuthority(url: string): boolean {
	const parts = /^(\[[^\]]*\]|[^:@]*)(?::[^@]*)?$/.exec(authorityOf(url));
	return parts !== null && isHost(parts[1] as string);
}

/** Whether the port, when there is one, is digits with no leading zero. */
function hasCanonicalPort(url: string): boolean {
	const port = /^(?:\[[^\]]*\]|[^:]*)(?::(.*))?$/.exec(authorityOf(url))?.[1];
	return port === undefined || /^(?:0|[1-9]\d{0,4})$/.test(port);
}

/** What follows `//` up to the first `/`, `?` or `#`. */
function authorityOf(url: string): string {
	return /^https?:\/\/([^/?#]*)/.exec(url)?.[1] ?? '';
}

/**
 * An absolute `http:` or `https:` URL, kept as sent. Other schemes are
 * refused — `javascript:` and `data:` among them — since a client is likely
 * to put the value in an `href`. The scheme is lowercase and followed by
 * `//` and a host (see {@link hasHostAuthority}); white space and control
 * characters are refused anywhere, rather than trimmed or dropped as
 * `z.url()` alone does, so the value is never rewritten. What a parser would
 * rewrite but reads the same is kept as sent: an uppercase host, a default
 * port (`:443`), dot segments, percent-escapes in the path.
 */
export const urlSchema = z
	.string()
	// `\p{Cf}`: a zero-width or bidi mark, which a parser percent-encodes
	// and a reader does not see.
	.refine((text) => !/[\s\p{Cc}\p{Cf}]/u.test(text), {
		error: 'Invalid URL: no white space, control or invisible character',
	})
	// A check, not a pipe: the checks run in this order both ways, so the
	// one above sees the value before `z.url()` trims it.
	// Exactly `^https?$`: Zod reads this source to also refuse
	// `https:example.com` and `http:/x`, which a looser pattern lets through.
	.check(z.url({ protocol: /^https?$/ }))
	.refine((text) => /^https?:/.test(text), {
		error: 'Invalid URL: write the scheme lowercase',
	})
	.refine(hasHostAuthority, {
		error:
			'Invalid URL: expected a host name, an IPv4 address or a bracketed IPv6 address, with no user info',
	})
	.refine(hasCanonicalPort, {
		error: 'Invalid URL: write the port as digits with no leading zero',
	});

export const URLScalar = zodScalar(urlSchema, {
	name: 'URL',
	description: 'An absolute http or https URL.',
	specifiedByURL: 'https://url.spec.whatwg.org/',
});
