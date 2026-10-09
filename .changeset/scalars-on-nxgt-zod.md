---
"@nxgt/graphql-scalars": minor
---

The schemas now come from `@nxgt/zod`, the package's one runtime dependency
(`^0.1.2`, peering the same `zod`). The exports and the behaviour are the same:
every scalar, `<name>Schema`, `schemas` and `scalarSchemas` keep their names,
keys, order and rules. Each schema is now `@nxgt/zod`'s own instance, so an
application that also imports `@nxgt/zod` holds one copy of each rule:
`uuidSchema` from either package is the same object.
