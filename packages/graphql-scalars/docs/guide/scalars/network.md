# Network scalars

The `network` category of `@nxgt/graphql-scalars`. Every scalar's export is `<Name>Scalar` and its schema `<name>Schema`; [the scalars guide](../scalars.md) covers what they share.

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
