# Number scalars

The `number` category of `@nxgt/graphql-scalars`. Every scalar's export is `<Name>Scalar` and its schema `<name>Schema`; [the scalars guide](../scalars.md) covers what they share.

Integers of 32 bits (as GraphQL's `Int`), finite floats, then the integers
beyond 32 bits. A float refuses `NaN` and `Infinity`.


Every integer scalar here (`PositiveInt`, `NegativeInt`, `NonNegativeInt`,
`NonPositiveInt`, `SafeInt`, `Port`, `Long`, `BigInt`) reads literals as
GraphQL's `Int` does: a float literal is refused even when it holds an
integer (`1.0`, `1e3`: `PositiveInt cannot represent a FloatValue literal`),
and so is `-0` (`Expected an integer, not -0`). A JSON variable `1.0` is the
number 1 and is accepted: JSON does not keep the difference.

## `PositiveInt`

Export `PositiveIntScalar`, schema `positiveIntSchema`. A number on both
sides. Accepts `1` and `2147483647`; refuses `0`, `-1`, `1.5`, `2147483648`
and `"1"`.

An integer from 1 to 2147483647. GraphQL's own `Int` is 32 bits, so this one
is too: a larger number could not be written by a client that follows the spec.
A float literal whose value is whole, such as `1.0`, is read as `1` and
accepted, where GraphQL's `Int` refuses it; `1.5` is refused.

```ts
import { PositiveIntScalar } from '@nxgt/graphql-scalars';

PositiveIntScalar.parseValue(2147483648);
// throws: PositiveInt cannot represent this input: Too big: expected number to be <=2147483647
```

The Int variants and the floats share one shape; each refuses the edge of its
own range:

```ts
import {
  NegativeIntScalar,
  NonNegativeFloatScalar,
  NonNegativeIntScalar,
  NonPositiveFloatScalar,
  NonPositiveIntScalar,
  PositiveFloatScalar,
  NegativeFloatScalar,
} from '@nxgt/graphql-scalars';

NonNegativeIntScalar.parseValue(0); // 0
NonNegativeIntScalar.parseValue(-1);
// throws: NonNegativeInt cannot represent this input: Too small: expected number to be >=0
NegativeIntScalar.parseValue(0);
// throws: NegativeInt cannot represent this input: Too big: expected number to be <0
NonPositiveIntScalar.parseValue(1);
// throws: NonPositiveInt cannot represent this input: Too big: expected number to be <=0

NonNegativeFloatScalar.parseValue(1.5); // 1.5
PositiveFloatScalar.parseValue(0);
// throws: PositiveFloat cannot represent this input: Too small: expected number to be >0
NegativeFloatScalar.parseValue(0);
// throws: NegativeFloat cannot represent this input: Too big: expected number to be <0
NonPositiveFloatScalar.parseValue(0.5);
// throws: NonPositiveFloat cannot represent this input: Too big: expected number to be <=0
PositiveFloatScalar.parseValue(Number.POSITIVE_INFINITY);
// throws: PositiveFloat cannot represent this input: Invalid input: expected number, received Infinity
```

## `NegativeInt`

Export `NegativeIntScalar`, schema `negativeIntSchema`. A number on both
sides. An integer from -2147483648 to -1; refuses `0` and `1`.

## `NonNegativeInt`

Export `NonNegativeIntScalar`, schema `nonNegativeIntSchema`. A number on both
sides. An integer from 0 to 2147483647; refuses `-1`.

## `NonPositiveInt`

Export `NonPositiveIntScalar`, schema `nonPositiveIntSchema`. A number on both
sides. An integer from -2147483648 to 0; refuses `1`.

## `PositiveFloat`

Export `PositiveFloatScalar`, schema `positiveFloatSchema`. A number on both
sides. A finite number above 0: accepts `0.5`; refuses `0`, `-0.5`, `NaN` and
`Infinity`.

## `NegativeFloat`

Export `NegativeFloatScalar`, schema `negativeFloatSchema`. A number on both
sides. A finite number below 0: accepts `-0.5`; refuses `0`.

## `NonNegativeFloat`

Export `NonNegativeFloatScalar`, schema `nonNegativeFloatSchema`. A number on
both sides. A finite number, 0 or above: accepts `0` and `1.5`; refuses `-0.5`.

## `NonPositiveFloat`

Export `NonPositiveFloatScalar`, schema `nonPositiveFloatSchema`. A number on
both sides. A finite number, 0 or below: accepts `0` and `-1.5`; refuses `0.5`.

## `SafeInt`

Export `SafeIntScalar`, schema `safeIntSchema`. A number on both sides.
Accepts `-9007199254740991` and `9007199254740991`; refuses `9007199254740992`
and `1.5`.

An integer JavaScript holds exactly, ±(2^53 - 1). It is beyond 32 bits, so it
is not GraphQL's `Int`: a query may write it as a literal, but a client's own
`Int` handling (generated types, for one) may not hold it. Past 2^53 use
`Long` or `BigInt`.

```ts
import { SafeIntScalar } from '@nxgt/graphql-scalars';

SafeIntScalar.parseValue(9007199254740992);
// throws: SafeInt cannot represent this input: Too big: expected int to be <=9007199254740991
```

## `Port`

Export `PortScalar`, schema `portSchema`. A number on both sides. A TCP or UDP
port, 0 to 65535; refuses `-1`, `65536` and `80.5`.

```ts
import { PortScalar } from '@nxgt/graphql-scalars';

PortScalar.parseValue(65536);
// throws: Port cannot represent this input: Too big: expected number to be <=65535
```

## `Long`

Export `LongScalar`, schema `longSchema`. A `bigint` in resolvers, a decimal
string on the wire. A signed 64-bit integer, -9223372036854775808 to
9223372036854775807.

JSON numbers past 2^53 lose precision in most clients, so the way **out** is
always a string, whatever the size. The way in accepts a canonical decimal
string (no leading zero, no `-0`, no `+`, no spaces) or a safe-integer number.
A `bigint` is not a wire value: passed as a variable from server code
(`graphql({ variableValues: { v: 5n } })`), it is refused; pass `'5'`.

```ts
import { LongScalar } from '@nxgt/graphql-scalars';

LongScalar.parseValue('9223372036854775807'); // 9223372036854775807n
LongScalar.parseValue(42); // 42n
LongScalar.serialize(-9223372036854775808n); // '-9223372036854775808'

LongScalar.parseValue('007');
// throws: Long cannot represent this input: Expected a decimal integer, with no leading zero and no "-0"
LongScalar.parseValue(1.5);
// throws: Long cannot represent this input: Expected a decimal integer string or a safe integer
LongScalar.parseValue('9223372036854775808');
// throws: Long cannot represent this input: Too big: expected bigint to be <=9223372036854775807
```

A resolver must return a `bigint`; a `number` is refused
(`BigInt(row.count)` fixes it, see [Troubleshooting](../../troubleshooting.md)).
In a query, a literal past 2^53 written as a number is refused, not rounded:
write it as a string, `"9223372036854775807"`, or pass a variable.

```ts
import { createSchema } from 'graphql-yoga';
import { pickScalars } from '@nxgt/graphql-scalars';

const { typeDefs, resolvers } = pickScalars('Long');

export const schema = createSchema({
  typeDefs: [typeDefs, /* GraphQL */ `type Query { views(id: Long!): Long! }`],
  resolvers: { ...resolvers, Query: { views: () => 9007199254740993n } },
});
// { data: { views: '9007199254740993' } }
```

## `BigInt`

Export `BigIntScalar`, schema `bigIntSchema`. The same as `Long` with no
range: an integer of any size, a `bigint` in resolvers and a decimal string on
the wire.

```ts
import { BigIntScalar } from '@nxgt/graphql-scalars';

BigIntScalar.parseValue('123456789012345678901234567890'); // a bigint
BigIntScalar.serialize(2n ** 80n); // '1208925819614629174706176'
```
