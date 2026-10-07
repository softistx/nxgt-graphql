# Network scalars

The `network` category of `@nxgt/graphql-scalars`. Every scalar's export is `<Name>Scalar` and its schema `<name>Schema`; [the scalars guide](../scalars.md) covers what they share.

## `IPv4`

Export `IPv4Scalar`, schema `ipv4Schema`. A string on both sides. Accepts
`192.168.0.1` and `255.255.255.255`; refuses `256.0.0.1`, `01.2.3.4` (a leading
zero), `1.2.3`, `1.2.3.4/8` (a prefix: use `CIDRv4`) and `::1`.

```ts
import { IPv4Scalar } from '@nxgt/graphql-scalars';

IPv4Scalar.parseValue('192.168.0.1'); // '192.168.0.1'
IPv4Scalar.parseValue('01.2.3.4');
// throws: IPv4 cannot represent this input: Invalid IPv4 address
```

## `IPv6`

Export `IPv6Scalar`, schema `ipv6Schema`. A string on both sides. Accepts every
RFC 4291 text form: full (`2001:0db8:0000:0000:0000:0000:0000:0001`),
compressed (`::1`, `2001:db8::1`) and with an embedded IPv4
(`::ffff:192.0.2.1`). Refuses a zone (`fe80::1%eth0`), `:::` and an IPv4.

The value is returned as sent, never normalised: `2001:DB8::1` and
`2001:db8:0:0:0:0:0:1` are the same address and two different strings. To
compare addresses, parse them first (with `node:net` or an IP library).

```ts
import { IPv6Scalar } from '@nxgt/graphql-scalars';

IPv6Scalar.parseValue('2001:DB8::1'); // '2001:DB8::1', case kept
IPv6Scalar.parseValue('fe80::1%eth0');
// throws: IPv6 cannot represent this input: Invalid IPv6 address
```

## `IP`

Export `IPScalar`, schema `ipSchema`. A string on both sides. An address that
`IPv4` or `IPv6` accepts, with their rules: `192.168.0.1`, `::1` and
`2001:db8::1` pass; `256.0.0.1` and `example.com` do not. As for `IPv6`, the
value is not normalised.

```ts
import { IPScalar } from '@nxgt/graphql-scalars';

IPScalar.parseValue('::1'); // '::1'
IPScalar.parseValue('example.com');
// throws: IP cannot represent this input: Expected an IPv4 or IPv6 address
```

## `CIDRv4`

Export `CIDRv4Scalar`, schema `cidrv4Schema`. A string on both sides: an IPv4
address, `/`, and a prefix length from 0 to 32. Accepts `10.0.0.0/8`,
`192.168.1.0/24` and `0.0.0.0/0`; refuses `10.0.0.0/33`, `10.0.0.0` (no prefix)
and `::/0`. The address need not be the first of the block: `10.0.0.5/8` is
accepted as sent.

```ts
import { CIDRv4Scalar } from '@nxgt/graphql-scalars';

CIDRv4Scalar.parseValue('10.0.0.0/8'); // '10.0.0.0/8'
CIDRv4Scalar.parseValue('10.0.0.0/33');
// throws: CIDRv4 cannot represent this input: Invalid IPv4 range
```

## `CIDRv6`

Export `CIDRv6Scalar`, schema `cidrv6Schema`. A string on both sides: an IPv6
address, `/`, and a prefix length from 0 to 128. Accepts `2001:db8::/32`,
`::/0` and `::1/128`; refuses `2001:db8::/129`, `2001:db8::` and `10.0.0.0/8`.
Like `IPv6`, the address is not normalised.

```ts
import { CIDRv6Scalar } from '@nxgt/graphql-scalars';

CIDRv6Scalar.parseValue('2001:db8::/32'); // '2001:db8::/32'
CIDRv6Scalar.parseValue('2001:db8::/129');
// throws: CIDRv6 cannot represent this input: Invalid IPv6 range
```

## `MAC`

Export `MACScalar`, schema `macSchema`. A string on both sides: six hex pairs
separated by `:`, all lowercase or all uppercase. Accepts `00:1a:2b:3c:4d:5e`
and `00:1A:2B:3C:4D:5E`; refuses mixed case (`00:1a:2B:3c:4d:5e`), `-` or `.`
separators, five pairs and the empty string. The case is kept: the two
spellings of one address are two different strings, so lowercase them before
comparing.

```ts
import { MACScalar } from '@nxgt/graphql-scalars';

MACScalar.parseValue('00:1A:2B:3C:4D:5E'); // '00:1A:2B:3C:4D:5E'
MACScalar.parseValue('00-1a-2b-3c-4d-5e');
// throws: MAC cannot represent this input: Invalid MAC address
```

## `Hostname`

Export `HostnameScalar`, schema `hostnameSchema`. A string on both sides:
dot-separated labels of letters, digits and hyphens (RFC 1123), none starting
or ending with a hyphen, each up to 63 characters and 253 in all. A trailing
dot is allowed (`example.com.`). The last label is not all digits, so an
IPv4 address (`1.2.3.4`) or `example.123` is not a host name (RFC 1123, 2.1:
use `IP` for an address). A single label (`localhost`) and punycode
(`xn--bcher-kva.example`) are; a Unicode label (`bücher.example`) is not.
Accepts `example.com`, `api.example.com` and `localhost`; refuses
`-example.com`, `exa_mple.com`, `1.2.3.4`, a space, the empty string and a
label of 64 characters. It checks the syntax only; nothing is resolved.

```ts
import { HostnameScalar } from '@nxgt/graphql-scalars';

HostnameScalar.parseValue('api.example.com.'); // 'api.example.com.'
HostnameScalar.parseValue('exa_mple.com');
// throws: Hostname cannot represent this input: Invalid hostname
```

## `PhoneNumber`

Export `PhoneNumberScalar`, schema `phoneNumberSchema`. A string on both sides,
in E.164 form: `+`, a country code that does not start with 0, and at most 15
digits in all, with no space or separator. Accepts `+33612345678` and
`+14155550123`; refuses `33612345678` (no `+`), `+0123456789`,
`+33 6 12 34 56 78`, a 16-digit number and the empty string. It checks the
shape, not that the number exists.

```ts
import { PhoneNumberScalar } from '@nxgt/graphql-scalars';

PhoneNumberScalar.parseValue('+33612345678'); // '+33612345678'
PhoneNumberScalar.parseValue('+33 6 12 34 56 78');
// throws: PhoneNumber cannot represent this input: Invalid E.164 number
```

## `URL`

Export `URLScalar`, schema `urlSchema`. A string on both sides. Accepts
`https://example.com/a?b=c` and `http://localhost:3000`; refuses
`javascript:`, `data:`, `mailto:` and `example.com`.

An absolute `http:` or `https:` URL, and nothing else. `javascript:` and
`data:` URLs are refused because a client is likely to put the value in an
`href`, which makes them a script-injection vector. As with `z.url()`, the
value is trimmed and tabs and line breaks are dropped, both ways:
`' https://x.com\n'` is `'https://x.com'`.

```ts
import { URLScalar } from '@nxgt/graphql-scalars';

URLScalar.parseValue('https://example.com/a?b=c'); // fine
URLScalar.parseValue('javascript:alert(1)');
// throws: URL cannot represent this input: Invalid URL
```

## `EmailAddress`

Export `EmailAddressScalar`, schema `emailAddressSchema`. A string on both
sides. Accepts `ada@example.com` and `a.b+c@sub.example.org`; refuses `ada`,
`ada@` and `a b@example.com`.

It is `z.email()`.
