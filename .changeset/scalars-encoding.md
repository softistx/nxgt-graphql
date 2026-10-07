---
'@nxgt/graphql-scalars': minor
---

A new `encoding` category with six scalars, each a string on both sides:
- `Base64` (padded) and `Base64URL` (unpadded), canonical spelling only: `YR==` decodes to the same byte as `YQ==` and is refused.
- `Hexadecimal`: not empty, any case, no `0x`.
- `JWT`: the compact form (RFC 7519 and 7515). The header and the payload must be JSON objects and the signature must not be empty. The header's `alg` must be a string other than `none`, so an unsecured token is refused even when it carries a signature. The signature itself is not verified.
- `SHA256` and `SHA512`: hex digests.
