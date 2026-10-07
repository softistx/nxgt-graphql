---
'@nxgt/graphql-scalars': minor
---

Eleven `number` scalars. `NegativeInt`, `NonNegativeInt` and `NonPositiveInt` are 32 bits, like `PositiveInt`. `PositiveFloat`, `NegativeFloat`, `NonNegativeFloat` and `NonPositiveFloat` take finite numbers only. `SafeInt` covers ±(2⁵³ − 1) and `Port` 0 to 65535. `Long` (signed 64-bit) and `BigInt` (unbounded) are a `bigint` in the resolvers and a decimal string on the wire. As input they take a canonical decimal string, or a safe-integer number. A resolver that returns a `number` for them is refused, and so is a query literal past 2⁵³ written as a number: it is never rounded.
