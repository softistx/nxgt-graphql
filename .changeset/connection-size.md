---
"@nxgt/graphql-validation": minor
---

`maxListCost`: a non-list field that states a size (a size argument given, or declared with a default) now sizes the lists declaring no size argument directly on its return type, such as a Relay connection's `edges` and `nodes`, instead of `defaultFirst`; this can lower a cost that used `defaultFirst`. An argument named in `sizeArguments` that does not size those lists should be left out of `sizeArguments`.
