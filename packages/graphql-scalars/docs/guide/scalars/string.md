# Strings scalars

The `string` category of `@nxgt/graphql-scalars`. Every scalar's export is `<Name>Scalar` and its schema `<name>Schema`; [the scalars guide](../scalars.md) covers what they share.

## `NonEmptyString`

Export `NonEmptyStringScalar`, schema `nonEmptyStringSchema`. A string on both
sides. Accepts `a` and ` a `; refuses `""`, `"   "` and `"\n\t"`.

A string with at least one non-white-space character; `" a "` is kept as it
is, not trimmed.
