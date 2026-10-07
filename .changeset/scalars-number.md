---
'@nxgt/graphql-scalars': minor
---

Eleven `number` scalars. `NegativeInt`, `NonNegativeInt` and `NonPositiveInt` are 32 bits, like `PositiveInt`. `PositiveFloat`, `NegativeFloat`, `NonNegativeFloat` and `NonPositiveFloat` take finite numbers only. `SafeInt` covers ±(2⁵³ − 1) and `Port` 0 to 65535. `Long` (signed 64-bit) and `BigInt` (unbounded) are a `bigint` in the resolvers and a decimal string on the wire. As input they take a canonical decimal string, or a safe-integer number. A resolver that returns a `number` for them is refused, and so is a query literal past 2⁵³ written as a number: it is never rounded.

`zodScalar` takes `literals: 'integer'`. With it, a float literal such as `1.0` or `1e3` is refused, as GraphQL's `Int` refuses it. Every integer scalar here uses it and also refuses `-0`. **Change for `PositiveInt`:** a query literal `1.0` used to be read as 1 and is now refused with `PositiveInt cannot represent a FloatValue literal`. A JSON variable `1.0` is still the number 1.
