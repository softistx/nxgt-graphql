# Identifier scalars

The `identifier` category of `@nxgt/graphql-scalars`. Every scalar's export is `<Name>Scalar` and its schema `<name>Schema`; [the scalars guide](../scalars.md) covers what they share.

Every identifier is a string on both sides, returned as sent: a value is
checked, never normalised, so `ULID`, `GUID` and `ObjectID` keep the case
the client used (`XID` is lowercase only). Compare them case-insensitively, or lower-case them in the
resolver.

## Choosing a UUID scalar

| Scalar | Takes | Pick it when |
| --- | --- | --- |
| `UUID` | an RFC 9562 UUID, any version | you accept ids from several sources |
| `UUIDv4` | version 4 (random) only | the id is generated at random, and a time-ordered one is a bug |
| `UUIDv7` | version 7 (time-ordered) only | rows are sorted or indexed by creation order |
| `GUID` | any 8-4-4-4-12 hex, no version or variant check | a Microsoft GUID, or a nil / hand-made id that `UUID` refuses |

Another version (`v1`, `v5`, …) or a hash variant is a one-liner with
`zodScalar`; see [Custom scalars](../custom-scalars.md):

```ts
import { z } from 'zod';
import { zodScalar } from '@nxgt/graphql-scalars';

export const UUIDv5 = zodScalar(z.uuid({ version: 'v5' }), { name: 'UUIDv5' });
```

## `UUID`

Export `UUIDScalar`, schema `uuidSchema`. A string on both sides. Accepts
`550e8400-e29b-41d4-a716-446655440000`; refuses a value with no hyphens and
`not-a-uuid`.

It is `z.uuid()`, the 8-4-4-4-12 form (RFC 9562).

```ts
import { UUIDScalar } from '@nxgt/graphql-scalars';

UUIDScalar.parseValue('550e8400-e29b-41d4-a716-446655440000');
UUIDScalar.parseValue('not-a-uuid');
// throws: UUID cannot represent this input: Invalid UUID
```

## `UUIDv4`

Export `UUIDv4Scalar`, schema `uuidv4Schema`. A string on both sides. Accepts
`123e4567-e89b-42d3-a456-426614174000`, in either case; refuses a version 7
(`017f22e2-79b0-7cc3-98c4-dc0c0c07398f`), a version 1
(`123e4567-e89b-12d3-a456-426614174000`) and a wrong variant. It is `z.uuidv4()`.

```ts
import { UUIDv4Scalar } from '@nxgt/graphql-scalars';

UUIDv4Scalar.parseValue('123e4567-e89b-42d3-a456-426614174000');
UUIDv4Scalar.parseValue('123e4567-e89b-12d3-a456-426614174000');
// throws: UUIDv4 cannot represent this input: Invalid UUID
```

## `UUIDv7`

Export `UUIDv7Scalar`, schema `uuidv7Schema`. A string on both sides. Accepts
`017f22e2-79b0-7cc3-98c4-dc0c0c07398f`; refuses a version 4 and a wrong variant
(`017f22e2-79b0-7cc3-c8c4-dc0c0c07398f`). It is `z.uuidv7()`.

```ts
import { UUIDv7Scalar } from '@nxgt/graphql-scalars';

UUIDv7Scalar.parseValue('017f22e2-79b0-7cc3-98c4-dc0c0c07398f');
UUIDv7Scalar.parseValue('123e4567-e89b-42d3-a456-426614174000');
// throws: UUIDv7 cannot represent this input: Invalid UUID
```

## `GUID`

Export `GUIDScalar`, schema `guidSchema`. A string on both sides. Any
8-4-4-4-12 hexadecimal string, in either case, with no version or variant check.
Accepts `123e4567-e89b-12d3-a456-426614174000`,
`ABCDEF01-2345-6789-ABCD-EF0123456789` and the nil
`00000000-0000-0000-0000-000000000000`; refuses the brace form
(`{123e4567-…}`), a value with no hyphens, non-hex digits and a number. It is
`z.guid()`.

```ts
import { GUIDScalar } from '@nxgt/graphql-scalars';

GUIDScalar.parseValue('ABCDEF01-2345-6789-ABCD-EF0123456789');
GUIDScalar.parseValue('{123e4567-e89b-12d3-a456-426614174000}');
// throws: GUID cannot represent this input: Invalid GUID
```

## `ULID`

Export `ULIDScalar`, schema `ulidSchema`. A string on both sides. 26 characters
of Crockford base32, the first 0 to 7. Accepts `01ARZ3NDEKTSV4RRFFQ69G5FAV`,
its lower-case form and `7ZZZZZZZZZZZZZZZZZZZZZZZZZ`; refuses a first character
above 7, an `I`, `L`, `O` or `U`, and a wrong length. It is `z.ulid()`; the case
is kept.

```ts
import { ULIDScalar } from '@nxgt/graphql-scalars';

ULIDScalar.parseValue('01arz3ndektsv4rrffq69g5fav'); // returned as sent
ULIDScalar.parseValue('81ARZ3NDEKTSV4RRFFQ69G5FAV');
// throws: ULID cannot represent this input: Invalid ULID
```

## `Cuid2`

Export `Cuid2Scalar`, schema `cuid2Schema`. A string on both sides. A lower-case
letter, then lower-case letters and digits, 2 to 32 characters in all (24 by
default). Accepts `tz4a98xxat96iws9zmbrgj3a` and `ab`; refuses `1abc` (starts
with a digit), `a` (too short), upper case, `-` and 33 characters.

It is stricter than `z.cuid2()`, which takes any run of lower-case letters and
digits and so lets `1abc` through; `cuid2Schema` adds the leading letter and the
length bounds.

```ts
import { Cuid2Scalar } from '@nxgt/graphql-scalars';

Cuid2Scalar.parseValue('tz4a98xxat96iws9zmbrgj3a');
Cuid2Scalar.parseValue('1abc');
// throws: Cuid2 cannot represent this input: Invalid cuid2
```

## `NanoID`

Export `NanoIDScalar`, schema `nanoIdSchema`. A string on both sides. A Nano ID
of the default shape: 21 characters of `A-Za-z0-9_-`. Accepts
`V1StGXR8_Z5jdHi6B-myT`; refuses 20 or 22 characters and any other character.
An id made with a custom size or alphabet needs a `zodScalar` of your own. It is
`z.nanoid()`.

```ts
import { NanoIDScalar } from '@nxgt/graphql-scalars';

NanoIDScalar.parseValue('V1StGXR8_Z5jdHi6B-myT');
NanoIDScalar.parseValue('V1StGXR8_Z5jdHi6B-my');
// throws: NanoID cannot represent this input: Invalid nanoid
```

## `KSUID`

Export `KSUIDScalar`, schema `ksuidSchema`. A string on both sides. 27
characters of base62, at most `aWgEPTl1tmebfsQzFP4bxwgy80V` (160 bits).
Accepts `0ujtsYcgvSTl8PAuAdqWYSMnLOv`; refuses 26 or 28 characters, any other
character, and a value past the maximum (`aWgEPTl1tmebfsQzFP4bxwgy80W`).

```ts
import { KSUIDScalar } from '@nxgt/graphql-scalars';

KSUIDScalar.parseValue('0ujtsYcgvSTl8PAuAdqWYSMnLOv');
KSUIDScalar.parseValue('0ujtsYcgvSTl8PAuAdqWYSMnLO');
// throws: KSUID cannot represent this input: Invalid KSUID
```

## `XID`

Export `XIDScalar`, schema `xidSchema`. A string on both sides. 20 characters of
lowercase base32hex (`0-9`, `a-v`), as rs/xid writes and reads it; 12 bytes
leave 4 bits unused, so the last character is `0` or `g`. Accepts
`9m4e2mr0ui3e8a215n4g`; refuses uppercase (`9M4E2MR0UI3E8A215N4G`), a last
character other than `0` or `g` (`9m4e2mr0ui3e8a215n4h`), a `w` to `z` and a
wrong length.

```ts
import { XIDScalar } from '@nxgt/graphql-scalars';

XIDScalar.parseValue('9m4e2mr0ui3e8a215n4g');
XIDScalar.parseValue('9m4e2mr0ui3e8a215n4w');
// throws: XID cannot represent this input: Invalid XID
```

## `ObjectID`

Export `ObjectIDScalar`, schema `objectIdSchema`. A MongoDB ObjectId as text:
24 hexadecimal digits, in either case, kept as sent. Accepts
`507f1f77bcf86cd799439011` and `507F1F77BCF86CD799439011`; refuses 23 or 25
digits, a non-hex digit and a leading space.

It is a string on both sides: map it to your driver's `ObjectId` in the
resolver.

```ts
import { ObjectIDScalar } from '@nxgt/graphql-scalars';

ObjectIDScalar.parseValue('507f1f77bcf86cd799439011');
ObjectIDScalar.parseValue('507f1f77bcf86cd79943901');
// throws: ObjectID cannot represent this input: Invalid ObjectID
```

```ts
// `mongodb` is your application's dependency, not this package's.
import { ObjectId } from 'mongodb';

// in a resolver
const _id = new ObjectId(args.id); // args.id is already a valid 24-digit string
```

## `ISBN`

Export `ISBNScalar`, schema `isbnSchema`. A string on both sides. An ISBN-10 or
an ISBN-13, digits only, its check digit verified.

- ISBN-10: nine digits and a tenth that is a digit or an uppercase `X`.
- ISBN-13: starts with `978`, or `979` followed by 1 to 9 (`979-0` is the
  ISMN, for printed music, not an ISBN).
- No hyphen, space or `ISBN` prefix: the value is the bare digits.

Accepts `0306406152`, `080442957X`, `9780306406157` and `9791090636071`;
refuses a wrong check digit (`0306406153`, `9780306406158`), a lower-case `x`
(`080442957x`), hyphens (`978-0-306-40615-7`), a `977` prefix and a wrong
length. A client that shows hyphens strips them before it sends.

```ts
import { ISBNScalar } from '@nxgt/graphql-scalars';

ISBNScalar.parseValue('9780306406157');
ISBNScalar.parseValue('978-0-306-40615-7');
// throws: ISBN cannot represent this input: Invalid ISBN
```

## `SemVer`

Export `SemVerScalar`, schema `semverSchema`. A string on both sides. A
Semantic Versioning 2.0.0 version, read with the regular expression semver.org
gives. Accepts `1.2.3`, `0.0.0`, `10.20.30` and `1.0.0-rc.1+build.5`; refuses
the `v` prefix (`v1.2.3`), a missing part (`1.2`), a leading zero (`01.2.3`,
`1.2.3-01`), an empty pre-release or build (`1.2.3-`, `1.2.3+`) and a space.

```ts
import { SemVerScalar } from '@nxgt/graphql-scalars';

SemVerScalar.parseValue('1.0.0-rc.1+build.5');
SemVerScalar.parseValue('v1.2.3');
// throws: SemVer cannot represent this input: Invalid semantic version
```

## In a schema

```ts
import { createSchema } from 'graphql-yoga';
import { pickScalars } from '@nxgt/graphql-scalars';

const { typeDefs, resolvers } = pickScalars('UUIDv7', 'SemVer', 'ISBN');

export const schema = createSchema({
  typeDefs: [
    typeDefs,
    /* GraphQL */ `
      type Query {
        release(id: UUIDv7!, version: SemVer!, isbn: ISBN): Boolean
      }
    `,
  ],
  resolvers: { ...resolvers, Query: { release: () => true } },
});
```
