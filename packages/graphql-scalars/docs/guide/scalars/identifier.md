# Identifiers scalars

The `identifier` category of `@nxgt/graphql-scalars`. Every scalar's export is `<Name>Scalar` and its schema `<name>Schema`; [the scalars guide](../scalars.md) covers what they share.

## `UUID`

Export `UUIDScalar`, schema `uuidSchema`. A string on both sides. Accepts
`550e8400-e29b-41d4-a716-446655440000`; refuses a value with no hyphens and
`not-a-uuid`.

It is `z.uuid()`, the 8-4-4-4-12 form (RFC 9562).
