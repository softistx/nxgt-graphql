---
"@nxgt/graphql-codegen-zod": minor
---

The plugin now writes the SDL's object types, interfaces and unions: `zUser` and `User`, typed as what a resolver returns (custom scalars decoded, `__typename` optional, unknown fields dropped), and each interface or union as a `z.union` of its object types. An object type in a cycle has its types written out (`User`, and `UserWire` for the wire value), so a long loop of types does not hit TS2589.

On by default, which can break a config that generated with 0.1.0: a custom scalar used only on output fields now needs a schema (`scalarSchemas` or `zodScalars`), and an object type named like a type the plugin already writes (`QueryFindArgs`, `FilterInput`) now clashes. `objects: false` gives 0.1.0's output back.
