# Encoding scalars

The `encoding` category of `@nxgt/graphql-scalars`. Every scalar's export is `<Name>Scalar` and its schema `<name>Schema`; [the scalars guide](../scalars.md) covers what they share. Every scalar here is a string on both sides.

## Bytes, not strings

These scalars check the text; the resolver receives the string, not the bytes
behind it. Decode where you need them:

```ts
import { Base64Scalar } from '@nxgt/graphql-scalars';

const text = Base64Scalar.parseValue('aGk='); // 'aGk=', still a string
const buffer = Buffer.from(text, 'base64'); // Node and Bun
const bytes = Uint8Array.fromBase64(text); // Uint8Array [104, 105]

// A Base64URL value names its alphabet:
Buffer.from('aGk', 'base64url');
Uint8Array.fromBase64('aGk', { alphabet: 'base64url' });
```

`Uint8Array.fromBase64` is recent: Bun, current browsers and recent Node have
it, older runtimes do not, and TypeScript types it only with an `esnext` lib.
Where it is missing, use `Buffer.from(text, 'base64')` (or `'base64url'`).

Another hash (`md5`, `sha1`, `sha384`) or another encoding is a one-liner, see
[Custom scalars](../custom-scalars.md):

```ts
import { z } from 'zod';
import { zodScalar } from '@nxgt/graphql-scalars';

export const MD5 = zodScalar(z.hash('md5'), { name: 'MD5' });
```

## `Base64`

Export `Base64Scalar`, schema `base64Schema`. Standard base64 (RFC 4648,
section 4) with its padding, in its one canonical spelling. Accepts `''` (no
bytes), `YQ==`, `aGk=` and `a+b/`; refuses `aGk` (no padding), `aGk==`,
`a-b_` (that is `Base64URL`), a space or a newline, and `YR==`: it decodes to
the same byte as `YQ==`, so it is a second spelling of the same bytes.

```ts
import { Base64Scalar } from '@nxgt/graphql-scalars';

Base64Scalar.parseValue('YQ=='); // 'YQ=='
Base64Scalar.parseValue('YR==');
// throws: Base64 cannot represent this input: Invalid base64
Base64Scalar.parseValue('aGk');
// throws: Base64 cannot represent this input: Invalid base64-encoded string
```

## `Base64URL`

Export `Base64URLScalar`, schema `base64UrlSchema`. URL-safe base64 (RFC 4648,
section 5): `-` and `_`, no padding, canonical spelling only. Accepts `''`,
`YQ`, `aGk` and `a-b_`; refuses `aGk=` (padding), `a+b/` (that is `Base64`),
`a b` and `YR` (a second spelling of `YQ`).

```ts
import { Base64URLScalar } from '@nxgt/graphql-scalars';

Base64URLScalar.parseValue('a-b_'); // 'a-b_'
Base64URLScalar.parseValue('YR');
// throws: Base64URL cannot represent this input: Invalid base64url
Base64URLScalar.parseValue('aGk=');
// throws: Base64URL cannot represent this input: Invalid base64url-encoded string
```

## `Hexadecimal`

Export `HexadecimalScalar`, schema `hexadecimalSchema`. One or more
hexadecimal digits, in any case, kept as sent (`AB` and `ab` are two strings).
An odd length is fine (`abc`). Refuses `''`, a `0x` prefix, a space and a
non-hex digit. For a digest of a known length use `SHA256` or `SHA512`.

```ts
import { HexadecimalScalar } from '@nxgt/graphql-scalars';

HexadecimalScalar.parseValue('deadBEEF'); // 'deadBEEF'
HexadecimalScalar.parseValue('');
// throws: Hexadecimal cannot represent this input: Expected at least one hexadecimal digit
HexadecimalScalar.parseValue('0x1f');
// throws: Hexadecimal cannot represent this input: Invalid hex
```

## `JWT`

Export `JWTScalar`, schema `jwtSchema`. A JSON Web Token in compact form
(RFC 7519, RFC 7515): three unpadded base64url parts joined by `.`; a header
and a payload that are JSON objects; a signature that is not empty; and a
header `alg` that is a string other than `none` (in any case). **Only the
shape is checked; the signature is not verified.** An unsecured token is
refused even when it carries a signature (RFC 7518, 3.6). `typ` is not
checked, so `at+jwt` access tokens pass. Refuses `a.b.c`, `a.b`, four parts,
a payload that is not a JSON object, and `''`.

```ts
import { JWTScalar } from '@nxgt/graphql-scalars';

const token =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.dozjgNryP4J3jVmNHl0w5N_XgL0n3I9PlFUP0THsR8U';

JWTScalar.parseValue(token); // token
JWTScalar.parseValue('eyJhbGciOiJub25lIn0.eyJzdWIiOiIxIn0.');
// throws: JWT cannot represent this input: Invalid JWT
JWTScalar.parseValue('a.b.c');
// throws: JWT cannot represent this input: Invalid JWT
```

A token that passed is well formed, not trusted. Verify it in the resolver
with a JWT library, for example `jose` (install it yourself; it is not a
peer of this package):

```ts
import { jwtVerify } from 'jose';

const secret = new TextEncoder().encode(process.env.JWT_SECRET);

export const resolvers = {
  Mutation: {
    // `token: JWT!` in the SDL: a string, well formed, not yet trusted
    signIn: async (_: unknown, args: { token: string }) => {
      const { payload } = await jwtVerify(args.token, secret); // throws if forged
      return { userId: payload.sub };
    },
  },
};
```

## `SHA256`

Export `SHA256Scalar`, schema `sha256Schema`. A SHA-256 digest: 64
hexadecimal digits, in either case, kept as sent. Refuses 63 or 65 digits, a
non-hex digit, a SHA-512 length and `''`.

```ts
import { SHA256Scalar } from '@nxgt/graphql-scalars';

SHA256Scalar.parseValue('A'.repeat(64)); // 'AAAA…', case kept
SHA256Scalar.parseValue('abc');
// throws: SHA256 cannot represent this input: Invalid SHA-256 digest: expected 64 hexadecimal digits
```

The case is not normalised, so compare digests case-insensitively:

```ts
const same = (a: string, b: string) => a.toLowerCase() === b.toLowerCase();
```

## `SHA512`

Export `SHA512Scalar`, schema `sha512Schema`. A SHA-512 digest: 128
hexadecimal digits, in either case, kept as sent; compare it case-insensitively
as for `SHA256`. Refuses 127 or 129 digits, a SHA-256 length and `''`.

```ts
import { SHA512Scalar } from '@nxgt/graphql-scalars';

SHA512Scalar.parseValue('f'.repeat(128)); // 'ffff…'
SHA512Scalar.parseValue('a'.repeat(64));
// throws: SHA512 cannot represent this input: Invalid SHA-512 digest: expected 128 hexadecimal digits
```
