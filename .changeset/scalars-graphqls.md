---
'@nxgt/graphql-scalars': minor
---

Ship `graphql/scalars.graphqls`, the SDL of every scalar, and an `nxgt-graphql-scalars` bin whose `typedefs [<Name>...] [--out [<file>]]` command prints or writes it, for IDEs and servers that scan `.graphql(s)` files. `--out` alone writes `generated/graphql/scalars.graphqls`.

`pickScalars` refuses a name only `Object.prototype` has (`toString`, `constructor`), as it refuses any unknown name: an untyped caller used to get past its check.
