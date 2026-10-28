---
'@nxgt/graphql-codegen-zod': minor
---

Export `variablesSchemaName(config, operationName, operationKind)` from the new `@nxgt/graphql-codegen-zod/naming` subpath: the exact name the plugin writes for an operation's variables schema, from the plugin's own config. The plugin names its schemas through it, so a companion plugin has one source of truth. Fixes #126.
