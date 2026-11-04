---
'@nxgt/graphql-validation': patch
---

Describe the shipped `@constraint` SDL: the directive and each of its 15 arguments now carry a description (what it enforces, bounds, the values it applies to, how a refusal reaches the client), in `constraintTypeDefs`, `graphql/constraint.graphqls` and `nxgt-graphql-validation typedefs`. A spec fails when any shipped SDL element lacks one. A rule now declares its `description`.
