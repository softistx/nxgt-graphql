import { describe, expect, test } from 'bun:test';
import { scalarCases } from '../../../test/scalar-cases';
import { URLScalar, urlSchema } from './url';

describe('URL', () => {
	scalarCases(URLScalar, {
		accepted: [
			'https://example.com/a?b=c',
			'http://localhost:3000',
			'https://EXAMPLE.com/Path#Top',
			'https://example.com.',
			'https://xn--bcher-kva.example/',
			'https://1.2.3.4/',
			'https://[::1]:8080/',
			'https://[2001:DB8::1]',
			'https://example.com:0/',
			'https://example.com:65535',
			'https://example.com/a%20b',
			'https://example.com?q',
		],
		refused: [
			'javascript:alert(1)',
			'data:text/plain,x',
			'mailto:a@b.c',
			'example.com',
			'https:example.com',
			'http:/x',
			'HTTPS://example.com',
			'Http://example.com',
			'https:///example.com',
			'https://',
			'https://user:pass@example.com',
			'https://user@example.com',
			'https://example.com\\@evil.com',
			// Read as IPv4 by a URL parser, never written so by a host.
			'https://123',
			'https://0x7f.1',
			'https://01.2.3.4',
			'https://1.2.3',
			'https://a_b.com',
			'https://-a.com',
			'https://a..b',
			'https://bücher.example',
			'https://ex%61mple.com',
			'https://[fe80::1%25eth0]',
			'https://[1.2.3.4]',
			'https://example.com:',
			'https://example.com:0080',
			'https://example.com:99999',
			// White space and control characters, never trimmed nor dropped.
			'https://example.com/a b',
			' https://example.com',
			'https://example.com ',
			'https://example.com\n',
			'https://exa\tmple.com',
			'https://example.com/\r',
			'https://example.com/\u0000',
			'https://example.com/\u007f',
			// Invisible format characters: zero-width space, bidi override.
			'https://example.com/a\u200bb',
			'https://example.com/\u202e',
			'https://example.com/ ',
			'',
			1,
		],
	});

	test('a value is never rewritten: what is taken comes back as sent', () => {
		expect(URLScalar.parseValue('https://EXAMPLE.com:443/./a')).toBe(
			'https://EXAMPLE.com:443/./a',
		);
		expect(() => URLScalar.parseValue(' https://x.com\n')).toThrow(
			'URL cannot represent this input: Invalid URL: no white space, control or invisible character',
		);
	});

	test('its z.url() check reads exactly /^https?$/', () => {
		// The refines on top also refuse `https:example.com`, so no case
		// above fails when this pattern loosens: the source is pinned here.
		const protocols = (urlSchema._zod.def.checks ?? []).map(
			(check) => (check._zod.def as { protocol?: RegExp }).protocol?.source,
		);
		expect(protocols.filter(Boolean)).toEqual(['^https?$']);
	});

	test('a port fault names the port', () => {
		expect(() => URLScalar.parseValue('https://x.com:080')).toThrow(
			'URL cannot represent this input: Invalid URL: write the port as digits with no leading zero',
		);
	});

	test('its refusals do not name the value', () => {
		expect(() => URLScalar.parseValue('https://user:secret@x.com')).toThrow(
			'URL cannot represent this input: Invalid URL: expected a host name, an IPv4 address or a bracketed IPv6 address, with no user info',
		);
		expect(() => URLScalar.serialize('HTTPS://x.com')).toThrow(
			'URL cannot serialize this value: Invalid URL: write the scheme lowercase',
		);
	});
});
