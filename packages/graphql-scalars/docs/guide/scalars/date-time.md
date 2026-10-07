# Date and time scalars

The `date-time` category of `@nxgt/graphql-scalars`. Every scalar's export is `<Name>Scalar` and its schema `<name>Schema`; [the scalars guide](../scalars.md) covers what they share.

## `DateTime`

Export `DateTimeScalar`, schema `dateTimeSchema`. Wire value a string,
resolver value a `Date`. Accepts `2024-03-10T12:00:00+02:00` and
`2024-03-10T10:00:00Z`; refuses a time with no offset, an impossible day and
`2024-03-10`.

An RFC 3339 date-time **with its offset** (`Z` or `±hh:mm`). A time without an
offset names no instant, so it is refused. A variable becomes a `Date`; the
way out calls `toISOString()`, so the wire value is always UTC, to the
millisecond: `…00.123456789Z` comes back as `…00.123Z`. A `Date` before year
0 or after 9999 has no RFC 3339 form and is refused on the way out.

```ts
import { DateTimeScalar } from '@nxgt/graphql-scalars';

const date = DateTimeScalar.parseValue('2024-03-10T12:00:00+02:00'); // Date
DateTimeScalar.serialize(date); // '2024-03-10T10:00:00.000Z'

DateTimeScalar.parseValue('2024-03-10T12:00:00');
// throws: DateTime cannot represent this input: Invalid ISO datetime
```

It serializes a `Date` **only**. A resolver that returns the string it read
from a database, without parsing it, is refused:

```ts
import { DateTimeScalar } from '@nxgt/graphql-scalars';

DateTimeScalar.serialize('2024-03-10T10:00:00.000Z');
// throws: DateTime cannot serialize this value: Invalid input: expected date, received string

DateTimeScalar.serialize(new Date('2024-03-10T10:00:00.000Z')); // fine
```

An invalid `Date` (`new Date(Number.NaN)`) is refused too.

## `Date`

Export `DateScalar`, schema `dateSchema`. A string on both sides. Accepts
`2024-02-29`; refuses `2023-02-29`, `2024-2-1`, a date-time and a number.

A calendar date, `YYYY-MM-DD`. It is not a `Date`
because a `Date` is an instant: turning a birthday into one shifts it by a day
in half the time zones. An impossible day (`2021-02-30`) is refused. If you
need arithmetic, parse it yourself where the zone is known.

```ts
import { DateScalar } from '@nxgt/graphql-scalars';

DateScalar.parseValue('2024-02-29'); // '2024-02-29'
DateScalar.parseValue('2023-02-29');
// throws: Date cannot represent this input: Invalid ISO date
```
