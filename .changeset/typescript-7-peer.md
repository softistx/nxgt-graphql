---
'@nxgt/graphql-scalars': patch
'@nxgt/graphql-validation': patch
'@nxgt/graphql-codegen-zod': patch
---

The `typescript` peer now accepts TypeScript 7 as well (`^6.0.3 || ^7.0.0`). The declarations are checked under both; nothing in these packages calls the TypeScript API at runtime.
